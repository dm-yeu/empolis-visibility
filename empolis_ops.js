// Imports
import got from 'got';
import isJSON from 'is-json';
import logger from './logger.js';
import { logResponse } from './logger.js';
import { getConfig } from './config.js'
import { getToken } from './empolis_admin.js';

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
 * Function to edit the metadata Title of a specific file using the Empolis INGEST API. The metadata is changed in the STORE and the INDEX is updated.
 * <br>See ['Edit Metadata' documentation]{@link https://esc-eu-central-1.empolisservices.com/doc/api/ingest/#tag/Metadata/operation/IngestMetadataProjectTypeProjectNamePost}.
 * <br>IMPORTANT NOTE: file metadata is completely overwritten by this function (update is not incremental). Therefore, first getFileMetadata(), extract the response, modify as needed, and then editFileMetadata().
 * @async
 * @function editFileMetadata
 * @memberof empolisOps
 * @param {string} authToken - authentication token for API requests
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
 * Function to get a record with a specific ID from the Empolis index using the IAS Service API.
 * <br>See ['Get Index Record' documentation]{@link https://yaskawa2.esc-eu-central-1.empolisservices.com/doc/api/ias/index.html#tag/Record-Management/operation/IasIndexIndexNameRecordIdGet}.
 * @async
 * @function getRecord
 * @memberof empolisOps
 * @param {string} authToken - authentication token for API requests
 * @param {string} recordId - record ID ('_id' attribute in search result)
 * @returns {Promise<JSON>} index record with all properties (if found)
 * @requires got
 */

export async function getRecord({ authToken, recordId }) {
  logger.debug(`getRecord() started`);
  const config = getConfig();

  const endpoint = `/api/ias/${config.IAS_API_VERSION}/index/project1_p/record/${recordId}`;
  const url = config.BASE_URL + endpoint;

  // Define got() request options
  const options = {
    url,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  };

  try {
    const response = await got(options).catch((error) => {
      if (isJSON(error.response.body)) {
        const errorBody = JSON.parse(error.response.body);
        console.error(
          `  got() Error: ${errorBody.statusCode} ${errorBody.error}\n  ${errorBody.message}`
        );
      }
      throw new Error('got() Error');
    });
    logResponse(response, 'getRecord() got response');

    return JSON.parse(response.body);
  } catch (error) {
    console.error(`getRecord() Error:\n${error}`);
    logger.error(`getRecord() Error:\n${error}`);
  }
}

/**
 * Function to update a record with a specific ID in the Empolis index using the IAS Service API.
 * <br>See ['Add Record' documentation]{@link https://yaskawa2.esc-eu-central-1.empolisservices.com/doc/api/ias/index.html#tag/Record-Management/operation/IasIndexIndexNameRecordPost}.
 * <br>CAUTION: all attributes and content for the record must be sent in the update request, it is not an incremental update! The previous record is deleted!
 * @async
 * @function updateRecord
 * @memberof empolisOps
 * @param {string} authToken - authentication token for API requests
 * @param {string} recordId  - record ID ('_recordid' attribute in search result)
 * @param {object} updatedRecord - updated record, including all metadata and content
 * @returns {Promise<JSON>} API request response body
 *
 */

export async function updateRecord({ authToken, recordId, updatedRecord }) {
  logger.debug(`updateRecord() started`);
  const config = getConfig();

  const endpoint = `/api/ias/${config.IAS_API_VERSION}/index/project1_p/record`;
  const url = config.BASE_URL + endpoint;

  // Define POST request body
  updatedRecord._recordid = recordId;
  updatedRecord._update = true;
  const data = updatedRecord;

  // Define got() request options
  const options = {
    url,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  };

  try {
    // Make update request to Empolis API
    const response = await got(options).catch((error) => {
      if (isJSON(error.response.body)) {
        const errorBody = JSON.parse(error.response.body);
        console.error(
          `  got() Error: ${errorBody.statusCode} ${errorBody.error}\n  ${errorBody.message}`
        );
      }
      throw new Error('got() Error');
    });
    logResponse(response, 'updateRecord() got response');

    // Return the response body as JSON
    return JSON.parse(response.body);
  } catch (error) {
    console.error(`updateRecord() Error:\n${error}`);
    logger.error(`updateRecord() Error:\n${error}`);
  }
}
