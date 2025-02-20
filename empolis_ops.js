// Imports
import got from 'got';
import chalk from 'chalk';
import logger, { logPrettyJson, logResponse } from './logger.js';
import { readJsonData } from './helpers.js';
import { getConfig } from './config.js'
import { getToken } from './empolis_admin.js';
import { fileSearch } from './empolis_search.js';

/**
 * Namespace for all elements related to Empolis File or Record operations
 * @namespace empolisOps
 */

const FILE_PATH_ERROR = "Metadata must contain 'FilePath'";

/**
 * Function that retrieves the metadata of a file using the Empolis STORE API.
 * <br>See ['Edit Metadata' documentation]{@link https://yaskawa2.esc-eu-central-1.empolisservices.com/doc/en/import/metadata-edit}.
 * @async
 * @function getFileMetadata
 * @memberof empolisOps
 * @param {string} path - file path ('DownloadLink' attribute)
 * @returns {Promise<JSON>} file metadata
 * @requires got
 */
export async function getFileMetadata({ path }) {
  logger.debug(`getFileMetadata() started`);
  const config = getConfig();
  try {
    const API_TOKEN = await getToken();
    const url = `${config.BASE_URL}/api/store/${config.STORE_API_VERSION}/file/${path}?metadata`;
    const headers = { Authorization: `Bearer ${API_TOKEN}` };
    const options = { headers };

    const response = await got.get(url, options);
    logResponse(response, 'getFileMetadata() got response');
    return JSON.parse(response.body);
  } catch (error) {
    console.error(`getFileMetadata() Error:\n${error}`);
    logger.error(`getFileMetadata() Error:\n${error}`);
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
export async function updateCloudMetadata({ fileList, indexFile }) {
  const config = getConfig();
  // Load the full index of files from the index file
  const index = await readJsonData(indexFile);
  // Update the metadata for each file in the index
  console.log(`  Updating the metadata of ${chalk.cyan(fileList.length)} files...`);
  logger.info(`Updating the metadata of ${fileList.length} files...`);
  for (const file of fileList) {
    const fileIndex = index.findIndex((obj) => obj.filename === file);
    const fileData = index[fileIndex];
    await processFile({ fileData });
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
 * @param {string} file - filename of the file to process
 * @param {string} htmlTitle - title extracted from the HTML file
 * @requires ./empolis_functions.js
 * @requires ./helpers.js
 * @returns nothing
 */
async function processFile({ dataObject }) {
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

/**
 * Function to edit the metadata Title of a specific file using the Empolis INGEST API. The metadata is changed in the STORE and the INDEX is updated.
 * <br>See ['Edit Metadata' documentation]{@link https://esc-eu-central-1.empolisservices.com/doc/api/ingest/#tag/Metadata/operation/IngestMetadataProjectTypeProjectNamePost}.
 * <br>IMPORTANT NOTE: file metadata is completely overwritten by this function (update is not incremental). Therefore, first getFileMetadata(), extract the response, modify as needed, and then editFileMetadata().
 * @async
 * @function editFileMetadata
 * @memberof empolisOps
 * @param {object} newMetadata - new metadata for the specified file
 * @returns {Promise<JSON>} API request response body
 * @requires got
 */

export async function editFileMetadata({ newMetadata }) {
  logger.debug(`editFileMetadata() started`);
  const config = getConfig();

  if (!newMetadata?.FilePath?.length) {
    throw new Error(FILE_PATH_ERROR);
  }

  const API_TOKEN = await getToken();

  // Define got() request options
  const url = `${config.BASE_URL}/api/ingest/${config.INGEST_API_VERSION}/metadata/environment/project1_p`;
  const headers = {
    Authorization: `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json',
  };
  const body = JSON.stringify(newMetadata);
  const options = { headers, body };

  try {
    // Make update request to Empolis API
    const response = await got.post(url, options);
    logResponse(response, 'editFileMetadata() got.post response');

    // Return the response statusCode
    return response.statusCode;
  } catch (error) {
    if (error.message === FILE_PATH_ERROR) {
      logger.error(
        "editFileMetadata() Error: the 'newMetadata' object must contain a 'FilePath' property to use the edit metadata API from the Empolis INGEST service"
      );
    } else {
      console.error(`editFileMetadata() Error:\n${error}`);
      logger.error(`editFileMetadata() Error:\n${error}`);
    }
  }
}


/**
 * @ignore
 * Function to get a record with a specific ID from the Empolis index using the IAS Service API.
 * <br>See ['Get Index Record' documentation]{@link https://yaskawa2.esc-eu-central-1.empolisservices.com/doc/api/ias/index.html#tag/Record-Management/operation/IasIndexIndexNameRecordIdGet}.
 * @async
 * @function getRecord
 * @memberof empolisOps
 * @param {string} recordId - record ID ('_id' attribute in search result)
 * @returns {Promise<JSON>} index record with all properties (if found)
 * @requires got
 */
/*async function getRecord({ recordId }) {
  logger.debug(`getRecord() started`);
  const config = getConfig();
  const API_TOKEN = await getToken();

  const endpoint = `/api/ias/${config.IAS_API_VERSION}/index/project1_p/record/${recordId}`;
  const url = config.BASE_URL + endpoint;

  // Define got.get() request options
  const options = {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
    },
  };

  try {
    const response = await got.get(url, options);
    logResponse(response, 'getRecord() got.get response');

    return JSON.parse(response.body);
  } catch (error) {
    console.error(`getRecord() Error:\n${error}`);
    logger.error(`getRecord() Error:\n${error}`);
  }
}*/

/**
 * @ignore
 * Function to update a record with a specific ID in the Empolis index using the IAS Service API.
 * <br>See ['Add Record' documentation]{@link https://yaskawa2.esc-eu-central-1.empolisservices.com/doc/api/ias/index.html#tag/Record-Management/operation/IasIndexIndexNameRecordPost}.
 * <br>CAUTION: all attributes and content for the record must be sent in the update request, it is not an incremental update! The previous record is deleted!
 * @async
 * @function updateRecord
 * @memberof empolisOps
 * @param {string} recordId  - record ID ('_recordid' attribute in search result)
 * @param {object} updatedRecord - updated record, including all metadata and content
 * @returns {Promise<JSON>} API request response body
 *
 */
/*async function updateRecord({ recordId, updatedRecord }) {
  logger.debug(`updateRecord() started`);
  const config = getConfig();
  const API_TOKEN = await getToken();

  const endpoint = `/api/ias/${config.IAS_API_VERSION}/index/project1_p/record`;
  const url = config.BASE_URL + endpoint;

  // Define POST request body
  updatedRecord._recordid = recordId;
  updatedRecord._update = true;
  const data = updatedRecord;

  // Define got() request options
  const options = {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  };

  try {
    // Make update request to Empolis API
    const response = await got.post(url, options);
    logResponse(response, 'updateRecord() got response');

    // Return the response body as JSON
    return JSON.parse(response.body);
  } catch (error) {
    console.error(`updateRecord() Error:\n${error}`);
    logger.error(`updateRecord() Error:\n${error}`);
  }
}*/
