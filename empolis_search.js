// Imports
import got, { HTTPError } from 'got';
import isJSON from 'is-json';
import logger from './logger.js';
import { logResponse } from './logger.js';
import { config } from './index.js';

/**
 * Namespace for all elements related to Empolis Search
 * @namespace empolisSearch
 */

/**
 * Function to search the Empolis index using the Natural Language Query (nlq) method against all text attributes.
 * <br>See [nlq seach reference documentation]{@link https://yaskawa2.esc-eu-central-1.empolisservices.com/doc/en/search/lines#search-line-nlq}.
 * @async
 * @function nlqSearch
 * @memberof empolisSearch
 * @param {string} authToken - authentication token for API requests
 * @param {string} searchTerm - search term in natural language
 * @param {number} [ maxResults = 10 ] - maximum number of search results, default is 10
 * @returns {Promise<JSON>} search results
 * @requires got
 */

export async function nlqSearch ({ authToken, searchTerm, maxResults = 10 }) {
  
  logger.debug(`nlqSearch() started`);
  
  const url = `${config.BASE_URL}/api/ias/${config.IAS_API_VERSION}/index/project1_p/search`;

  // Define POST request body
    // nlq (Natural Language Query)
  const data = {
                  "query": {
                    "nlq": `${searchTerm}`
                  },
                  "maxCount": maxResults,
                  "resultAttributes": ["Title", "FileName", "DownloadLink"]
                };
  
  // Define got() request options
  const options = {
    url,
    method: 'POST',
    headers: {
      'Authorization' : `Bearer ${authToken}`,
      'Content-Type' : 'application/json'
    },
    body: JSON.stringify(data),
  };

  try {

    // Make search request to Empolis API
    const response = await got(options);
    logResponse(response, 'nlqSearch() got response');

    // Return the complete response body as JSON
    return JSON.parse(response.body);
  }
  catch (error) {
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
 * @param {string} source - Empolis data source to search against
 * @param {string} searchTerm - search term in natural language
 * @param {string} [ searchAttribute = "DownloadLink" ] - attribute to search, default is "DownloadLink"
 * @param {number} [ maxResults = 1 ] - maximum number of search results, default is 1
 * @returns {Promise<JSON>} search results
 * @requires got
 */

export async function vfqSearch ({ authToken, source, searchTerm, searchAttribute = "DownloadLink", maxResults = 1 }) {

  logger.debug(`vfqSearch() started`);
  
  if (searchAttribute === "DownloadLink") {
    searchTerm = `${source}/${searchTerm}`
  } else if (searchAttribute === "FileName") {
    throw new Error('FileName attribute not allowed');
  }
  
  // Define got() request options
  const url = `${config.BASE_URL}/api/ias/${config.IAS_API_VERSION}/index/project1_p/search`;
  const method = 'POST';
  const headers = { 
    Authorization : `Bearer ${authToken}`,
    'Content-Type' : 'application/json'
  };
  const data = {
    "query": {
      "attribute": `${searchAttribute}`,
      "value": `${searchTerm}`
    },
    "maxCount": maxResults,
    "resultAttributes": ["Title", "FileName", "DownloadLink"]
  };
  const body = JSON.stringify(data);
  const options = { url, method, headers, body };

  try {

    // Make vfqSearch request to Empolis API
    const response = await got(options)
      .catch(error => {
        if (isJSON(error.response.body)) {
          const errorBody = JSON.parse(error.response.body);
          console.error(`  got() Error: ${errorBody.statusCode} ${errorBody.error}\n  ${errorBody.message}`);
        }
        throw new Error('got() Error');
      });
    logResponse(response, 'vfqSearch() got response');

    // Return the complete response body as JSON
    return JSON.parse(response.body);
  }
  catch (error) {
    if (error.message === "FileName attribute not allowed") {
      logger.error("The \'FileName\' attribute cannot be searched against with the Empolis vfq Query method.");
    } else {
      console.error(`vfqSearch() Error:\n${error}`);
      logger.error(`vfqSearch() Error:\n${error}`);
    }
  }
}
