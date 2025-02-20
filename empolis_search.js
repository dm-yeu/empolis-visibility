// Imports
import got from 'got';
import chalk from 'chalk';
import util from 'util';
import logger from './logger.js';
import { logResponse } from './logger.js';
import { getConfig } from './config.js';
import { getToken } from './empolis_admin.js';
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
  logger.debug(`fileSearch() started`);
  try {
    // Define search query
    /*const vfq = {
      attribute: 'DownloadLink',
      value: `${config.DATA_SOURCE}/${searchTerm}`,
    };*/
    const nlq = {
      attribute: 'FileName',
      nlq: searchTerm,
    };
    // Define search query parameters
    const queryParameters = {
      maxCount: 1,
      resultAttributes: ['Title', 'FileName', 'DownloadLink'],
    };
    // Search the Empolis index for the specified file
    const searchResults = await indexSearch({
      queryObject: nlq,
      queryParameters,
    });
    // If search results are found, return the metadata
    if (searchResults?.records?.length) {
      if (consoleOutput) {
        console.log(`${chalk.green('√')}` + ` ${chalk.cyan(searchTerm)} file found in the index.`);
      }
      const firstResult = searchResults.records[0];
      const downloadLink = firstResult.DownloadLink;
      const fileMetadata = await getFileMetadata({ path: downloadLink });
      if (consoleOutput) {
        console.log(
          `\n` +
            `  Metadata for ${searchTerm}:` +
            `\n` +
            `${util.inspect(fileMetadata, { depth: null, colors: true })}` +
            `\n`
        );
      }
      return fileMetadata;
      // If no search results are found, log a message and return null
    } else {
      if (consoleOutput) {
        console.log(
          `${chalk.red('X')}` +
            ` No search results for '${chalk.cyan(searchTerm)}' file in the index.`
        );
      }
      logger.info(`No search results for '${searchTerm}' file in the index.`);
      return null;
    }
  } catch (error) {
    console.error(`fileSearch() Error:\n${error}`);
    logger.error(`fileSearch() Error:\n${error}`);
  }
}

/**
 * Function to search the Empolis index.
 * <br>See [index search reference documentation]{@link https://yaskawa2.esc-eu-central-1.empolisservices.com/doc/en/search/request}.
 * @async
 * @function indexSearch
 * @memberof empolisSearch
 * @param {object} queryObject - search [query object]{@Link https://yaskawa2.esc-eu-central-1.empolisservices.com/doc/en/search/lines}
 * @param {object} queryParameters - search [query parameters]{@Link https://yaskawa2.esc-eu-central-1.empolisservices.com/doc/api/ias/index.html#tag/Search/operation/IasIndexIndexNameSearchPost}
 * @returns {Promise<JSON>} search results
 * @requires got
 * @requires empolis_admin
 */
export async function indexSearch({ queryObject, queryParameters }) {
  logger.debug(`indexSearch() started`);
  const config = getConfig();
  try {
    const API_TOKEN = await getToken();
    // Define got() request options
    const url = `${config.BASE_URL}/api/ias/${config.IAS_API_VERSION}/index/project1_p/search`;
    const headers = {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    };
    const data = {
      query: queryObject,
      ...queryParameters,
    };
    const body = JSON.stringify(data);
    const options = { headers, body };
    // Make index search request to Empolis API
    const response = await got.post(url, options);
    logResponse(response, 'indexSearch() got.post response');

    return JSON.parse(response.body);
  } catch (error) {
    console.error(`indexSearch() Error:\n${error}`);
    logger.error(`indexSearch() Error:\n${error}`);
  }
}
