// Imports
import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'node:path';
import util from 'util';
import { loadConfig } from './helpers.js';

/**
 * Configuration functions
 * @namespace log
 * @memberof module:logger
 */

/**
 * Configures and initializes the winston logger with daily rotation and error handling.
 * @async
 * @function initializeLogger
 * @memberof module:logger.log
 * @returns {Promise<winston.Logger>} Winston logger instance
 * @throws Error if logger initialization fails
 * @requires winston
 * @requires winston-daily-rotate-file
 * @requires path
 * @requires helpers
 */
async function initializeLogger() {
  try {
    const config = await loadConfig();
    if (config.LOG_LEVEL === 'debug') {
      console.log(
        `initializeLogger() config:\n${util.inspect(config, { depth: null, colors: false })}`
      );
    }

    const errorRotateTransport = new winston.transports.DailyRotateFile({
      filename: path.join(config.LOG_DIRECTORY, 'empolis-visibility_%DATE%_error.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d',
      level: 'error',
    });

    const combinedRotateTransport = new winston.transports.DailyRotateFile({
      filename: path.join(config.LOG_DIRECTORY, 'empolis-visibility_%DATE%_combined.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d',
    });

    const logger = winston.createLogger({
      level: config.LOG_LEVEL,
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD H:mm:ss.SSS',
        }),
        winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`),
        winston.format.errors()
      ),
      transports: [errorRotateTransport, combinedRotateTransport],
    });

    return logger;
  } catch (error) {
    console.error(`Error initializing logger: ${error.message}\n${error.stack}`);
    throw error;
  }
}

const logger = await initializeLogger();
export default logger;

/**
 * Function to log the response from a got() request with a nice format (LOG_LEVEL: debug)
 * @function logResponse
 * @memberof logging
 * @param {object} response the response from a got() request
 */
export function logResponse(response, logEntryTitle = 'got() response') {
  const formattedBody = JSON.stringify(JSON.parse(response.body), null, 2);

  logger.debug(`${logEntryTitle}:
    statusCode: ${response.statusCode}
    body:
    ${formattedBody
      .split('\n')
      .map((line) => '  ' + line)
      .join('\n')}`); // add indentation to response.body
}

/**
 * Function to log a JSON object with a nice format (LOG_LEVEL: debug)
 * @function logPrettyJson
 * @memberof logging
 * @param {object} jsonObject the JSON object to be logged
 * @returns {null}
 */
export function logPrettyJson(jsonObject, logEntryTitle = 'JSON object') {
  const formattedObject = util.inspect(jsonObject, {
    depth: null,
    colors: false,
    maxArrayLength: null,
    maxStringLength: null,
    compact: false,
    breakLength: 80,
  });

  logger.debug(`${logEntryTitle}:
    ${formattedObject
      .split('\n')
      .map((line) => '  ' + line)
      .join('\n')}`); // add indentation to object
  return null;
}
