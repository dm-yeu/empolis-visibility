// Imports
import { loadConfig, setConfig, getConfig } from './config.js';
import { getToken } from './empolis_admin.js';
import { fileSearch } from './empolis_search.js';
import { editFileMetadata } from './empolis_ops.js';
import { readJsonData } from './helpers.js';
import { createUpdateIndexFile } from './index_creation.js';
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
const initialConfig = await loadConfig();
configureLogger(initialConfig);
setConfig(initialConfig);
// Load full config with user prompt and api test
const fullConfig = await loadConfig({ promptUser: true, testApi: true });
setConfig(fullConfig);

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
  let config = getConfig();
  logger.debug(`main() function started`);

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
        if (fileMetadata) logger.info(`fileMetadata:\n${JSON.stringify(fileMetadata)}`);
      }
      // Prompt user to perform another operation
      newOperation = await confirm(
        { message: 'Perform another operation', default: false },
        { signal: AbortSignal.timeout(60000) }
      );
      if (newOperation) {
        logger.info(`User selected to perform another operation`);
        setConfig(await loadConfig({ promptUser: true }));
        config = getConfig();
      } else {
        logger.info(`User selected to end the program`);
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
  const config = getConfig();
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

  const editMetadataResponse = await editFileMetadata({ newMetadata });
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
