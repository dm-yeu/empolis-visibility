// Imports
import got from 'got';
import chalk from 'chalk';
import util from 'util';
import logger from './logger.js';
import { logResponse } from './logger.js';
import { config } from './index.js';
import { getToken, checkApiStatus } from './empolis_admin.js';
import { getFileMetadata } from './empolis_ops.js';

/**
 * Namespace for all elements related to Empolis Search
 * @namespace empolisSearch
 */

/**
 * Search the Empolis data source specified in the config for a specific file and return the metadata if existing.
 * @async
 * @function fileSearch
 * @memberof empolisSearch
 * @param {string} searchTerm - search term (should be filename with extension)
 * @param {boolean} [consoleOutput = false] - flag to enable console output
 * @returns {Promise<JSON>} file metadata
 * @requires empolis_admin
 * @requires empolis_ops
 * @requires chalk
 */
export async function fileSearch({ searchTerm, consoleOutput = false }) {
  try {
    const API_TOKEN = await getToken();
    await checkApiStatus(API_TOKEN);

    const searchResults = await vfqSearch({
      authToken: API_TOKEN,
      searchTerm: `${config.DATA_SOURCE}/${searchTerm}`,
      searchAttribute: 'DownloadLink',
      resultAttributes: ['Title', 'FileName', 'DownloadLink'],
      maxResults: 1,
    });
    if (searchResults?.records?.length) {
      if (consoleOutput) {
        console.log(
          `${chalk.green('√')}` +
            ` ${chalk.cyan(searchTerm)} found in the '${config.dataSourceSelection}' data source.`
        );
      }
      const firstResult = searchResults.records[0];
      const downloadLink = firstResult.DownloadLink;
      const fileMetadata = await getFileMetadata({ authToken: API_TOKEN, path: downloadLink });
      if (consoleOutput) {
        console.log(
          `\n`+
          `  Metadata for ${searchTerm}:` +
          `\n` +
          `${util.inspect(fileMetadata, { depth: null, colors: true })}` +
          `\n`
        );
      }
      return fileMetadata;
    } else {
      if (consoleOutput) {
        console.log(
          `${chalk.red('X')}` +
            ` No search results for '${chalk.cyan(searchTerm)}' in the '${config.dataSourceSelection}' data source`
        );
      }
      return null;
    }
  } catch (error) {
    console.error(`fileSearch() Error:\n${error}`);
    logger.error(`fileSearch() Error:\n${error}`);
  }
}

/**
 * Function to search the Empolis index using the Natural Language Query (nlq) method against all text attributes.
 * <br>See [nlq seach reference documentation]{@link https://yaskawa2.esc-eu-central-1.empolisservices.com/doc/en/search/lines#search-line-nlq}.
 * @async
 * @function nlqSearch
 * @memberof empolisSearch
 * @param {string} authToken - authentication token for API requests
 * @param {string} searchTerm - search term in natural language
 * @param {string} [ searchAttribute = "" ] - attribute to search, default is all text attributes
 * @param {array} [ resultAttributes = null ] - attributes to return in search results, default is all attributes
 * @param {number} [ maxResults = 10 ] - maximum number of search results, default is 10
 * @returns {Promise<JSON>} search results
 * @requires got
 */

export async function nlqSearch({ 
  authToken, 
  searchTerm,
  searchAttribute = "",
  resultAttributes = null,
  maxResults = 10,
}) {
  logger.debug(`nlqSearch() started`);

  // Validate resultAttributes parameter
  if (resultAttributes !== null && !Array.isArray(resultAttributes)) {
    throw new Error(`resultAttributes must be an array of strings or null`);
  }

  const url = `${config.BASE_URL}/api/ias/${config.IAS_API_VERSION}/index/project1_p/search`;

  // nlq (Natural Language Query)
  const data = {
    query: {
      nlq: `${searchTerm}`,
      attribute: `${searchAttribute}`,
    },
    maxCount: maxResults,
    resultAttributes,
  };

  const options = {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  };

  try {
    const response = await got.post(url, options);
    logResponse(response, 'nlqSearch() got response');

    return JSON.parse(response.body);
  } catch (error) {
    console.error(`nlqSearch() Error:\n${error}`);
    logger.error(`nlqSearch() Error:\n${error}`);
  }
}

/**
 * Function to search the Empolis index using the Value Filter Query (vfq) method.
 * <br>vfq search queries cannot be made against text attributes (for example 'FileName'). A match will be found only if the search term matches the attribute value completely.
 * <br>See [vfq seach reference documentation]{@link https://yaskawa2.esc-eu-central-1.empolisservices.com/doc/en/search/lines#search-line-vfq}.
 * @async
 * @function vfqSearch
 * @memberof empolisSearch
 * @param {string} authToken - authentication token for API requests
 * @param {string} searchTerm - search term in natural language
 * @param {string} [ searchAttribute = "DownloadLink" ] - attribute to search, default is "DownloadLink"
 * @param {array} [ resultAttributes = null ] - attributes to return in search results, default is all attributes
 * @param {number} [ maxResults = 1 ] - maximum number of search results, default is 1
 * @returns {Promise<JSON>} search results
 * @requires got
 */

export async function vfqSearch({
  authToken,
  searchTerm,
  searchAttribute = 'DownloadLink',
  resultAttributes = null,
  maxResults = 1,
}) {
  logger.debug(`vfqSearch() started`);

  if (searchAttribute === 'FileName') {
    throw new Error(`FileName attribute not allowed`);
  }

  // Validate resultAttributes parameter
  if (resultAttributes !== null && !Array.isArray(resultAttributes)) {
    throw new Error(`resultAttributes must be an array of strings or null`);
  }

  // Define got() request options
  const url = `${config.BASE_URL}/api/ias/${config.IAS_API_VERSION}/index/project1_p/search`;
  const headers = {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };
  const data = {
    query: {
      attribute: `${searchAttribute}`,
      value: `${searchTerm}`,
    },
    maxCount: maxResults,
    resultAttributes,
  };
  const body = JSON.stringify(data);
  const options = { headers, body };

  try {
    // Make vfqSearch request to Empolis API
    const response = await got.post(url, options);
    logResponse(response, 'vfqSearch() got.post response');

    return JSON.parse(response.body);
  } catch (error) {
    if (error.message === 'FileName attribute not allowed') {
      logger.error(
        "The 'FileName' and other TEXT attributes cannot be searched against with the vfq method."
      );
    } else {
      console.error(`vfqSearch() Error:\n${error}`);
      logger.error(`vfqSearch() Error:\n${error}`);
    }
  }
}
