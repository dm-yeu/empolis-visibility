// Imports
import { getToken } from './empolis_admin.js';
import { fileSearch } from './empolis_search.js';
import { editFileMetadata } from './empolis_ops.js';
import { loadConfig, getHtmlFiles, readJsonData } from './helpers.js';
import { createFileIndex } from './index_creation.js';
import logger, { configureLogger, logPrettyJson } from './logger.js';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'url';
import path from 'node:path';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { confirm, input } from '@inquirer/prompts';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: __dirname + `/.env` });

// Initialize basic config for logger
const initialConfig = await loadConfig({ promptUser: false, testApi: false });
configureLogger(initialConfig);

// Load full config with user prompt
export let config = await loadConfig({ promptUser: true, testApi: true });
logger.debug(`config:\n${config}`);

/**
 * Main function.
 * <br>Gets the filenames of all html files in a each directory, creates a file index, and updates the relevant
 * metadata in the corresponding document in Empolis.
 * @async
 * @function main
 * @requires performance
 * @requires path
 * @requires getToken
 * @requires checkApiStatus
 * @requires getHtmlFiles
 * @requires createFileIndex
 * @requires logger
 */

async function main() {
  const startTime = performance.now();
  logger.info(`Run of empolis-visibility main() started`);

  try {
    let newOperation = true;
    let fileList = [];
    let indexFile = '';
    while (newOperation) {
      // Create index file for the data source if user selects 'index' or 'update' operation
      if (config.OPERATION === 'index' || config.OPERATION === 'update') {
        ({ fileList, indexFile } = await createUpdateIndexFile());
      }
      // Update metadata for each file in the index if user selects 'update' operation
      if (config.OPERATION === 'update') {
        await updateCloudMetadata({ fileList, indexFile });
      }
      // Search for a specific file in the data source if user selects 'file_search' operation
      if (config.OPERATION === 'file_search') {
        const searchTerm = await input({ message: 'Enter the filename to search for:' });
        const fileMetadata = await fileSearch({ searchTerm, consoleOutput: true });
        logger.info(`fileMetadata:\n${JSON.stringify(fileMetadata)}`);
      }
      // Prompt user to perform another operation
      newOperation = await confirm(
        { message: 'Perform another operation', default: false },
        { signal: AbortSignal.timeout(10000) }
      );
      if (newOperation) {
        config = await loadConfig({ promptUser: true });
      }
    }
  } catch (error) {
    if (error.name === 'AbortPromptError') {
      console.log(`${chalk.red('X')} Timeout. Operation cancelled due to inactivity`);
      logger.info(`Timeout. Operation cancelled due to inactivity`);
    } else {
      console.error(`main() Error:\n${error}`);
      logger.error(`main() Error:\n${error}`);
    }
  } finally {
    const endTime = performance.now();
    const executionTime = (endTime - startTime) / 1000; // Convert ms to seconds
    logger.info(`Total execution time: ${executionTime.toFixed(2)} seconds`);
    console.log(
      `Total execution time: ${chalk.cyan(executionTime.toFixed(2))} seconds.` +
        ` Logs can be found in ${chalk.cyan(logger.transports[0].dirname)}.`
    );
  }
}

/**
 * Create or update an index file with all source files contained in the original data source
 * @async
 * @function createUpdateIndexFile
 * @memberof fileIndex
 * @requires confirm
 * @requires helpers
 * @requires index_creation
 * @returns {Promise<Object>} Object containing the list of files as an array, and the index file path
 */
async function createUpdateIndexFile() {
  try {
    // Prompt user to confirm the directory for the source files of the data source
    config.OK = await confirm({
      message: `The directory for the files of data source '${config.dataSourceSelection}' is '${config.FILE_DIR}'. Continue?`,
    });

    // Throw error if user cancels the operation due to incorrect configuration
    if (!config.OK) {
      logger.info(`User cancelled the operation due to configuration errors`);
      console.log(
        `${chalk.red('X')}` +
          ` Operation cancelled. Check configuration in ${chalk.cyan('./config.yaml')}.`
      );
      throw new Error('Operation cancelled');
    }

    const fileList = await getHtmlFiles(config.FILE_DIR);
    console.log(
      `  Found ${chalk.cyan(fileList.length)} HTML files in data source directory. Creating index file...`
    );
    logger.info(
      `Found ${fileList.length} HTML files in data source directory. Creating index file.`
    );
    const indexFile = await createFileIndex({
      directoryPath: config.FILE_DIR,
      fileList,
    });
    console.log(
      `${chalk.green('√')}` +
        ` Index file for '${config.dataSourceSelection}' source data created at ${chalk.cyan(indexFile)}`
    );
    logger.info(
      `Index file for '${config.dataSourceSelection}' source data created at ${indexFile}`
    );
    return { fileList, indexFile };
  } catch (error) {
    if (error.message === 'Operation cancelled') {
      return { fileList: [], indexFile: '' };
    } else {
      logger.error(`createUpdateIndexFile() Error:\n${error}`);
      throw new Error(`Failed to create index file: ${error.message}`);
    }
  }
}

/**
 * Update the metadata of files in the Empolis cloud with information from the index file
 * @async
 * @function updateCloudMetadata
 * @memberof empolis_ops
 * @param {Array} fileList - list of filenames to update metadata for
 * @param {string} indexFile - path of the index file containing metadata
 * @requires empolis_admin
 * @returns {Promise<null>} null
 */
async function updateCloudMetadata({ fileList, indexFile }) {
  const API_TOKEN = await getToken();
  // Load the full index of files from the index file
  const index = await readJsonData(indexFile);
  // Update the metadata for each file in the index
  console.log(`  Updating the metadata of ${chalk.cyan(fileList.length)} files...`);
  logger.info(`Updating the metadata of ${fileList.length} files...`);
  for (const file of fileList) {
    const fileIndex = index.findIndex((obj) => obj.filename === file);
    const fileData = index[fileIndex];
    await processFile(API_TOKEN, fileData);
  }
  console.log(
    `${chalk.green('√')}` +
      ` Completed metadata update operation for '${config.dataSourceSelection}' data source`
  );
  logger.info(
    `Completed metadata update operation for '${config.dataSourceSelection}' data source`
  );
  return null;
}

/**
 * Function to modify the metadata of a file via the Empolis INGEST API
 * <br> Only modifies metadata with editFileMetadata() if it does not have the correct value already
 * @async
 * @function processFile
 * @param {string} authToken - authentication token for API requests
 * @param {string} file - filename of the file to process
 * @param {string} htmlTitle - title extracted from the HTML file
 * @requires ./empolis_functions.js
 * @requires ./helpers.js
 * @returns nothing
 */

async function processFile(authToken, dataObject) {
  logger.info(`Processing ${dataObject.filename}`);
  logger.debug(`dataObject: ${JSON.stringify(dataObject)}`);

  // Search for file in the user selected data source to get the current metadata
  const fileMetadata = await fileSearch({ searchTerm: dataObject.filename, consoleOutput: false });

  let newKeywords = '';
  if (dataObject.breadcrumbs) {
    for (const keyword of dataObject.breadcrumbs) {
      newKeywords = newKeywords + keyword + '; ';
    }
    newKeywords = newKeywords.trim();
  }

  // Check if 'Title' and 'Keywords' are already correct
  if (fileMetadata.Title && dataObject.title) {
    if (fileMetadata.Title.toLowerCase() === dataObject.title.toLowerCase()) {
      logger.info(`${dataObject.filename} already has the correct title`);
      // Return if keywords and title already match
      if (fileMetadata.Keywords_txt) {
        if (fileMetadata.Keywords_txt.toLowerCase() === newKeywords.toLowerCase()) {
          logger.info(
            `${dataObject.filename} already has the correct title and keywords, metadata will not be updated`
          );
          return;
        }
      }
      // Return if title matches, entry has no keywords, and there are no new keywords to be added
      else if (newKeywords.length === 0) {
        logger.info(
          `Keywords for ${dataObject.filename} do not exist and title is correct, metadata will not be updated`
        );
        return;
      }
    }
  }

  // Build new metadata object with Title and optional Keywords
  let newMetadata = { ...fileMetadata, Title: dataObject.title };
  if (newKeywords.length > 0) {
    newMetadata = { ...newMetadata, Keywords_txt: newKeywords };
  }
  logPrettyJson(newMetadata, 'newMetadata');

  const editMetadataResponse = await editFileMetadata({ authToken, newMetadata });
  if (editMetadataResponse === 202) {
    logger.info(`${dataObject.filename} metadata modified successfully`);
  } else {
    logger.error(`Failed to modify metadata for ${dataObject.filename}`);
  }
}

main();

// Check if the current module is the main module before calling main()
/*if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}*/
