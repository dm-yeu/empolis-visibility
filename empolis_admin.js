// Imports
import got, { HTTPError } from 'got';
import logger from './logger.js';
import { logResponse } from './logger.js';
import { config } from './index.js';

/**
 * Namespace for all elements related to Empolis administration and authentication
 * @namespace empolisAdmin
 */


/**
 * Function to check status of all Empolis API services
 * @async
 * @function checkApiStatus
 * @memberof empolisAdmin
 * @param {string} authToken - authentication token for API requests 
 * @requires ./empolis_functions.js
 * @returns error if an API is not operational
 */

export async function checkApiStatus(authToken) {

  logger.debug(`checkApiStatus() started`)

  const apiChecks = [
    apiOperational(authToken, 'ingest', config.INGEST_API_VERSION),
    apiOperational(authToken, 'ias', config.IAS_API_VERSION),
    apiOperational(authToken, 'store', config.STORE_API_VERSION)
  ];

  const results = await Promise.all(apiChecks);
  const serviceNames = ['INGEST', 'IAS', 'STORE'];

  results.forEach((result, index) => {
    if (!result) {
      throw new Error(`${serviceNames[index]} Service Down`);
    }
  });

  logger.info('All Empolis services are operational');
}
  

 /**
 * Function to retrieve the authentication token used with the Empolis API. Authentication with the Empolis API is handled via the 
 * [Resource Owner Password Credentials Grant]{@link https://yaskawa2.esc-eu-central-1.empolisservices.com/doc/en/getting-started/api-authorization#curl-resource-owner-password-credentials-grant} 
 * method.
 * <br>Credentials are stored in the .env file (.gitignore) in project root.
 * @async
 * @function getToken
 * @memberof empolisAdmin
 * @returns {Promise<string>} Token to authenticate Empolis API requests
 * @requires dotenv
 * @requires got
 */

export async function getToken() {

  logger.debug(`getToken() started`);

  const url = `${config.BASE_URL}/oauth2/token`;

  // Get credentials from process.env - ensure dotenv.config() is called previously in main
  const { API_USERNAME, API_PASSWORD, CLIENT_ID, CLIENT_SECRET } = process.env;

  if (!API_USERNAME || !API_PASSWORD || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing required environment variables');
  }

  // Define POST request body
  const data = `grant_type=password&username=${API_USERNAME}&password=${API_PASSWORD}&scope=${config.API_SCOPE}`;
  
  // Define got() request options
  const options = {
    url,
    method: 'POST',
    username: CLIENT_ID,
    password: CLIENT_SECRET,
    headers: {
      'content-type' : 'application/x-www-form-urlencoded'
    },
    body: data,
  };

  try {

    // Make token request to Empolis API
    const response = await got(options);
    logResponse(response, 'getToken() got response');

    // Return the access token
    return JSON.parse(response.body).access_token;
  }
  catch (error) {
    logger.error(`getToken() Error:\n${error}`);
  }
}
  
  
/**
 * Function to retrieve the status of a specified Empolis API.
 * @async
 * @function apiOperational
 * @memberof empolisAdmin
 * @param {string} authToken - authentication token for API requests
 * @param {string} apiName - name of the API to query
 * @param {string} apiVersion - API version to query
 * @returns {Promise<string>} operational status of the API (true if operational)
 * @requires got
 */

export async function apiOperational (authToken, apiName, apiVersion) {

  logger.debug(`apiOperational(${apiName}, ${apiVersion}) started`);
  
  const url = `${config.BASE_URL}/api/${apiName}/${apiVersion}/alive`

  // Define got() request options
  const options = {
    url,
    method: 'GET',
    headers: {
      'Authorization' : `Bearer ${authToken}`
    },
  }

  try {
    const response = await got(options);
    logResponse(response, 'apiOperational() got response');    

    // Return the status (opearational true/false) of the specified Empolis Ingest API version
    return JSON.parse(response.body).operational;
  }
  catch (error) {
    console.error(`apiOperational() Error:\n${error}`);
    logger.error(`apiOperational() Error:\n${error}`);
  }
}
  