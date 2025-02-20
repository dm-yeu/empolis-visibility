// Imports
import got from 'got';
import logger from './logger.js';
import { logResponse } from './logger.js';
import { getConfig } from './config.js';
import chalk from 'chalk';

/**
 * Namespace for all elements related to Empolis administration and authentication
 * @namespace empolisAdmin
 */

/**
 * Cached token information to avoid unnecessary requests
 * @type {Object}
 * @property {string} accessToken - access token for Empolis API
 * @property {string} refreshToken - refresh token for Empolis API
 * @property {number} accessTokenExpirationTime - expiration time of access token
 * @property {number} refreshTokenExpirationTime - expiration time of refresh token
 * @memberof empolisAdmin
 * @private
 */
let tokenCache = {
  accessToken: null,
  refreshToken: null,
  accessTokenExpirationTime: null,
  refreshTokenExpirationTime: null,
};

/**
 * Function to retrieve the authentication token used with the Empolis API. Authentication with the Empolis API is handled via the
 * [Resource Owner Password Credentials Grant]{@link https://yaskawa2.esc-eu-central-1.empolisservices.com/doc/en/getting-started/api-authorization#curl-resource-owner-password-credentials-grant}
 * method.
 * <br>Credentials are stored in the .env file (.gitignore) in project root.
 * <br>Token is cached and reused until expiration. If expired, it attempts to refresh using the refresh token.
 * @async
 * @function getToken
 * @memberof empolisAdmin
 * @returns {Promise<string>} Token to authenticate Empolis API requests
 * @requires dotenv
 * @requires got
 */
export async function getToken() {
  logger.debug(`getToken() started`);
  const config = getConfig();
  const currentTime = Date.now();

  // Check if we have a valid cached access token
  if (
    tokenCache.accessToken &&
    tokenCache.accessTokenExpirationTime &&
    currentTime < tokenCache.accessTokenExpirationTime
  ) {
    logger.debug('Using cached access token');
    return tokenCache.accessToken;
  }

  // If we have a valid refresh token, try to use it
  if (
    tokenCache.refreshToken &&
    tokenCache.refreshTokenExpirationTime &&
    currentTime < tokenCache.refreshTokenExpirationTime
  ) {
    try {
      logger.debug('Attempting to use refresh token');
      const tokenResponse = await refreshAccessToken(tokenCache.refreshToken);
      // Update token cache with new tokens
      tokenCache.accessToken = tokenResponse.access_token;
      tokenCache.refreshToken = tokenResponse.refresh_token;
      tokenCache.accessTokenExpirationTime = currentTime + (tokenResponse.expires_in - 60) * 1000;
      tokenCache.refreshTokenExpirationTime = currentTime + 24 * 60 * 60 * 1000; // 24 hours

      logger.debug(
        `Token refreshed, will expire at: ${new Date(tokenCache.accessTokenExpirationTime).toISOString()}`
      );

      return tokenCache.accessToken;
    } catch (error) {
      logger.warn('Failed to refresh token, will attempt to get new tokens', error);
      // Clear token cache since refresh failed
      tokenCache = {
        accessToken: null,
        refreshToken: null,
        accessTokenExpirationTime: null,
        refreshTokenExpirationTime: null,
      };
    }
  }

  // Token expired, refresh token expired, or no token available --> get new token
  const url = `${config.BASE_URL}/oauth2/token`;

  const { API_USERNAME, API_PASSWORD, CLIENT_ID, CLIENT_SECRET } = process.env;
  if (!API_USERNAME || !API_PASSWORD || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing required environment variables');
  }

  const options = {
    username: CLIENT_ID,
    password: CLIENT_SECRET,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=password&username=${API_USERNAME}&password=${API_PASSWORD}&scope=${config.API_SCOPE}`,
  };

  try {
    const response = await got.post(url, options);
    logResponse(response, 'getToken() got response');

    const tokenResponse = JSON.parse(response.body);

    // Cache the new tokens
    tokenCache.accessToken = tokenResponse.access_token;
    tokenCache.refreshToken = tokenResponse.refresh_token;
    tokenCache.accessTokenExpirationTime = currentTime + (tokenResponse.expires_in - 60) * 1000;
    tokenCache.refreshTokenExpirationTime = currentTime + 24 * 60 * 60 * 1000; // 24 hours

    logger.debug(
      `New tokens cached, access token will expire at: ${new Date(tokenCache.accessTokenExpirationTime).toISOString()}`
    );

    return tokenCache.accessToken;
  } catch (error) {
    // Clear cache on error
    tokenCache = {
      accessToken: null,
      refreshToken: null,
      accessTokenExpirationTime: null,
      refreshTokenExpirationTime: null,
    };
    logger.error(`getToken() Error:\n${error}`);
    throw error;
  }
}

/**
 * Function to refresh the access token using a refresh token
 * @async
 * @function refreshAccessToken
 * @private
 * @param {string} refreshToken - The refresh token to use
 * @returns {Promise<Object>} Object containing the new access token and refresh token
 * @throws {Error} If the refresh token is invalid or expired
 */
async function refreshAccessToken(refreshToken) {
  logger.debug('Attempting to refresh access token');
  try {
    const config = getConfig();
    const { CLIENT_ID, CLIENT_SECRET } = process.env;
    const url = `${config.BASE_URL}/oauth2/token`;
    const options = {
      username: CLIENT_ID,
      password: CLIENT_SECRET,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
    };
    const response = await got.post(url, options);
    logResponse(response, 'refreshAccessToken() got response');
    return JSON.parse(response.body);
  } catch (error) {
    logger.error(`refreshAccessToken() Error:\n${error}`);
    throw error;
  }
}

/**
 * Function to check status of all Empolis API services
 * @async
 * @function checkApiStatus
 * @memberof empolisAdmin
 * @requires ./empolis_functions.js
 * @returns error if an API is not operational
 */
export async function checkApiStatus() {
  logger.debug(`checkApiStatus() started`);
  const config = getConfig();
  const API_TOKEN = await getToken();

  const apiChecks = [
    apiOperational({
      authToken: API_TOKEN,
      apiName: 'ingest',
      apiVersion: config.INGEST_API_VERSION,
    }),
    apiOperational({
      authToken: API_TOKEN,
      apiName: 'ias',
      apiVersion: config.IAS_API_VERSION,
    }),
    apiOperational({
      authToken: API_TOKEN,
      apiName: 'store',
      apiVersion: config.STORE_API_VERSION,
    }),
  ];

  const results = await Promise.all(apiChecks);
  const serviceNames = ['INGEST', 'IAS', 'STORE'];

  results.forEach((result, index) => {
    if (!result) {
      throw new Error(`Empolis ${serviceNames[index]} Service Down`);
    }
  });
  console.log(`${chalk.green('√')} All Empolis services are operational`);
  logger.info('All Empolis services are operational');
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
async function apiOperational({ authToken, apiName, apiVersion }) {
  logger.debug(`apiOperational(${apiName}, ${apiVersion}) started`);
  try {
    const config = getConfig();
    const url = `${config.BASE_URL}/api/${apiName}/${apiVersion}/alive`;
    const options = {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    };
    const response = await got.get(url, options);
    logResponse(response, 'apiOperational() got.get response');
    return JSON.parse(response.body).operational;
  } catch (error) {
    console.error(`apiOperational() Error:\n${error}`);
    logger.error(`apiOperational() Error:\n${error}`);
  }
}
