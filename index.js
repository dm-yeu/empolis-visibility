// Imports
import { getToken, checkApiStatus } from './empolis_admin.js';
import { vfqSearch } from './empolis_search.js';
import { getFileMetadata, editFileMetadata } from './empolis_ops.js';
import { loadConfig, getHtmlFiles, readJsonData } from './helpers.js';
import { createFileIndex } from './index_creation.js';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'url';
import path from 'node:path';
import dotenv from 'dotenv';
import logger, { logPrettyJson } from './logger.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: __dirname + `/.env` });

// Load configuration
export const config = await loadConfig();
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
  console.log(
    `Run of empolis-visibility main() started, logs can be found in ${logger.transports[0].dirname}`
  );

  try {
    // Get API token for authentication
    const API_TOKEN = await getToken();

    // Check status of APIs
    await checkApiStatus(API_TOKEN, startTime);

    // Get html filenames from specified directores
    const icubeFiles = await getHtmlFiles(config.ICUBE_HELP_DIR);
    const dwezFiles = await getHtmlFiles(config.DWEZ_HELP_DIR);

    // Create index of all HTML files in the specified directories
    const icubeIndexFile = await createFileIndex({
      directoryPath: config.ICUBE_HELP_DIR,
      fileList: icubeFiles,
    });
    const dwezIndexFile = await createFileIndex({
      directoryPath: config.DWEZ_HELP_DIR,
      fileList: dwezFiles,
    });

    // Update the metadata of each file in the index (iCube)
    const icubeIndex = await readJsonData(icubeIndexFile);
    for (const file of icubeFiles) {
      const index = icubeIndex.findIndex((obj) => obj.filename === file);
      const fileData = icubeIndex[index];
      await processFile(API_TOKEN, config.ICUBE_DATA_SOURCE, fileData);
    }

    // Update the metadata of each file in the index (DWEZ)
    const dwezIndex = await readJsonData(dwezIndexFile);
    for (const file of dwezFiles) {
      const index = dwezIndex.findIndex((obj) => obj.filename === file);
      const fileData = dwezIndex[index];
      await processFile(API_TOKEN, config.DWEZ_DATA_SOURCE, fileData);
    }
  } catch (error) {
    console.error(`main() Error:\n${error}`);
    logger.error(`main() Error:\n${error}`);
  } finally {
    const endTime = performance.now();
    const executionTime = (endTime - startTime) / 1000; // Convert ms to seconds
    logger.info(`Done. Execution time: ${executionTime.toFixed(2)} seconds`);
    console.log(`Done. Execution time: ${executionTime.toFixed(2)} seconds`);
  }
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

async function processFile(authToken, dataSource, dataObject) {
  logger.info(`Processing ${dataObject.filename}`);
  logger.debug(`dataObject: ${JSON.stringify(dataObject)}`);

  // Search for html file in the Empolis index to get the 'DownloadLink' attribute
  const searchResults = await vfqSearch({
    authToken,
    source: dataSource,
    searchTerm: dataObject.filename,
  });
  if (!searchResults?.records?.length) {
    logger.warn(`No search results for the term '${dataObject.filename}' found in the index`);
    return;
  }

  const firstResult = searchResults.records[0];
  const downloadLink = firstResult.DownloadLink;

  // Get the metadata of the file with the specified 'DownloadLink'
  const fileMetadata = await getFileMetadata({ authToken, path: downloadLink });

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

  // Build new metadata object with Title and Keywords (optional)
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

//main ();
// Check if the current module is the main module before calling main()
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
