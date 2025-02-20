// Imports
import { loadConfig, setConfig, getConfig } from './config.js';
import { fileSearch } from './empolis_search.js';
import { updateCloudMetadata } from './empolis_ops.js';
import { createUpdateIndexFile } from './index_creation.js';
import logger, { configureLogger } from './logger.js';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'url';
import path from 'node:path';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { confirm, input } from '@inquirer/prompts';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: __dirname + `/.env` });

// Initialize basic config for logger
const initialConfig = await loadConfig();
configureLogger(initialConfig);
setConfig(initialConfig);
// Load full config with user prompt and api test
const fullConfig = await loadConfig({ promptUser: true, testApi: true });
setConfig(fullConfig);

/**
 * Main function.
 * <br>Gets the filenames of all html files in a each directory, creates a file index, and updates the relevant
 * metadata in the corresponding document in Empolis.
 * @async
 * @function main
 * @requires performance
 * @requires path
 * @requires getToken
 * @requires checkApiStatus
 * @requires getHtmlFiles
 * @requires createFileIndex
 * @requires logger
 */

async function main() {
  const startTime = performance.now();
  let config = getConfig();
  logger.debug(`main() function started`);

  try {
    let newOperation = true;
    let fileList = [];
    let indexFile = '';
    while (newOperation) {
      // Create index file for the data source if user selects 'index' or 'update' operation
      if (config.OPERATION === 'index' || config.OPERATION === 'update') {
        ({ fileList, indexFile } = await createUpdateIndexFile());
      }
      // Update metadata for each file in the index if user selects 'update' operation
      if (config.OPERATION === 'update') {
        await updateCloudMetadata({ fileList, indexFile });
      }
      // Search for a specific file in the data source if user selects 'file_search' operation
      if (config.OPERATION === 'file_search') {
        const searchTerm = await input({ message: 'Enter the filename to search for:' });
        const fileMetadata = await fileSearch({ searchTerm, consoleOutput: true });
        if (fileMetadata) logger.info(`fileMetadata:\n${JSON.stringify(fileMetadata)}`);
      }
      // Prompt user to perform another operation
      newOperation = await confirm(
        { message: 'Perform another operation', default: false },
        { signal: AbortSignal.timeout(60000) }
      );
      if (newOperation) {
        logger.info(`User selected to perform another operation`);
        setConfig(await loadConfig({ promptUser: true }));
        config = getConfig();
      } else {
        logger.info(`User selected to end the program`);
      }
    }
  } catch (error) {
    if (error.name === 'AbortPromptError') {
      console.log(`${chalk.red('X')} Timeout. Operation cancelled due to inactivity`);
      logger.info(`Timeout. Operation cancelled due to inactivity`);
    } else {
      console.error(`main() Error:\n${error}`);
      logger.error(`main() Error:\n${error}`);
    }
  } finally {
    const endTime = performance.now();
    const executionTime = (endTime - startTime) / 1000; // Convert ms to seconds
    logger.info(`Total execution time: ${executionTime.toFixed(2)} seconds`);
    console.log(
      `Total execution time: ${chalk.cyan(executionTime.toFixed(2))} seconds.` +
        ` Logs can be found in ${chalk.cyan(logger.transports[0].dirname)}.`
    );
  }
}

main();

// Check if the current module is the main module before calling main()
/*if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}*/
