// Imports
import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'node:path';
import util from 'util';

// Create the log format configuration
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD H:mm:ss.SSS',
  }),
  winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`),
  winston.format.errors()
);

// Create a default logger - initially with a console transport only
let logger = winston.createLogger({
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: logFormat
    })
  ]
});

/**
 * Configures and initializes the winston logger with daily rotation and error handling.
 * All logs will be written to files only, preserving the console for user interface.
 * @function configureLogger
 * @param {Object} config - Configuration object containing LOG_LEVEL and LOG_DIRECTORY
 * @throws Error if logger initialization fails
 */
export function configureLogger(config) {
  try {
    // Create the file transports
    const errorRotateTransport = new winston.transports.DailyRotateFile({
      filename: path.join(config.LOG_DIRECTORY, 'empolis-visibility_%DATE%_error.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d',
      level: 'error',
      format: logFormat
    });
    const combinedRotateTransport = new winston.transports.DailyRotateFile({
      filename: path.join(config.LOG_DIRECTORY, 'empolis-visibility_%DATE%_combined.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d',
      format: logFormat
    });

    // Clear existing transports
    logger.clear();

    // Add only file transports, regardless of LOG_LEVEL
    logger.add(errorRotateTransport);
    logger.add(combinedRotateTransport);

    // Set the log level
    logger.level = config.LOG_LEVEL;

    // Log the initial configuration to the file
    logger.info(`Logger configured with level: ${config.LOG_LEVEL}`);
    logger.info(`Log directory: ${config.LOG_DIRECTORY}`);

  } catch (error) {
    console.error(`Error configuring logger: ${error.message}\n${error.stack}`);
    throw error;
  }
}

/**
 * Utility function to verify logger configuration
 * Logs the verification to the configured log files instead of console
 */
export function verifyLoggerConfiguration() {
  const transports = logger.transports;
  logger.info('Verifying logger configuration');
  logger.info(`Number of active transports: ${transports.length}`);
  
  transports.forEach((transport, index) => {
    logger.info(`Transport ${index + 1}: ${transport.name}, ` +
      `level: ${transport.level}, ` +
      `filename: ${transport.filename || 'N/A'}`);
  });
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
