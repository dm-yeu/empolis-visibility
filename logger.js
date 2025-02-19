// Imports
import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'node:path';
import util from 'util';

// Create a default logger with console transport that will be replaced later
let logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD H:mm:ss.SSS',
        }),
        winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
      )
    })
  ]
});

/**
 * Configures and initializes the winston logger with daily rotation and error handling.
 * @function configureLogger
 * @param {Object} config - Configuration object containing LOG_LEVEL and LOG_DIRECTORY
 * @throws Error if logger initialization fails
 */
export function configureLogger(config) {
  try {
    if (config.LOG_LEVEL === 'debug') {
      console.log(
        `configureLogger() config:\n${util.inspect(config, { depth: null, colors: false })}`
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

    // Clear existing transports and add new ones
    logger.clear();  // Remove all transports
    logger.add(errorRotateTransport);
    logger.add(combinedRotateTransport);
    logger.level = config.LOG_LEVEL;

  } catch (error) {
    console.error(`Error configuring logger: ${error.message}\n${error.stack}`);
    throw error;
  }
}

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
      .join('\n')}`);
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
      .join('\n')}`);
  return null;
}
