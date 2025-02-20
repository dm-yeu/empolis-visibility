// config.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import util from 'util';
import { select } from '@inquirer/prompts';
import { checkApiStatus } from './empolis_admin.js';
import logger from './logger.js';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Internal state
let config = null;

export function setConfig(newConfig) {
  config = newConfig;
  logger.info(`setConfig() updated configuration:\n${JSON.stringify(config, null, 2)}`);
  if (config.LOG_LEVEL === 'debug') {
    console.log(
      `setConfig() updated configuration:\n${util.inspect(config, { depth: null, colors: true })}`
    );
  }
}

export function getConfig() {
  if (!config) {
    throw new Error('Configuration not initialized');
  }
  return config;
}

/**
 * Load configuration from YAML file
 * @async
 * @function loadConfig
 * @param {Object} options - Configuration options
 * @param {boolean} [options.promptUser=false] - Prompt user for configuration data
 * @param {boolean} [options.testApi=false] - Test the API status
 * @returns {Promise<Object>} Parsed configuration object
 */
export async function loadConfig({ promptUser = false, testApi = false } = {}) {
  try {
    // Build the absolute path to the config.yaml file
    const configPath = path.join(__dirname, 'config.yaml');
    // Read the YAML file
    const fileContents = await fs.readFile(configPath, 'utf8');
    // Parse YAML to JavaScript object
    const loadedConfig = yaml.load(fileContents);

    // Check the API status if the OPERATION is not set
    if (!loadedConfig.OPERATION && testApi) await checkApiStatus();

    // Return the configuration object if promptUser is false
    if (!promptUser) return loadedConfig;

    // Prompt user to select the operation to perform on the data source
    loadedConfig.OPERATION = await select({
      message: 'Select the operation to perform:',
      choices: [
        {
          name: 'Create index file',
          value: 'index',
          description: 'Create an index of all files in the data source with associated metadata',
        },
        {
          name: 'Update index file and metadata',
          value: 'update',
          description: 'Update the index and metadata for all files in the data source',
        },
        {
          name: 'Filename search',
          value: 'file_search',
          description: 'Search the data source for a specific file',
        },
      ],
    });

    if (loadedConfig.OPERATION != 'file_search') {
      // Prompt user for data source selection
      loadedConfig.dataSourceSelection = await select({
        message: 'Select the data source:',
        choices: [
          { name: 'iCube', value: 'iCube', description: 'Help files for iCube Engineer' },
          { name: 'DWEZ', value: 'DWEZ', description: 'Help files for DriveWorks EZ' },
          { name: 'ELO KB Public', value: 'ELO_KB', description: 'ELO DMC Knowledge Base (Public)'}
        ],
      });

      loadedConfig.DATA_SOURCE = loadedConfig.EMPOLIS_BOX_ROOT;
      // Configure the data source based on user selection
      switch (loadedConfig.dataSourceSelection) {
        case 'iCube':
          loadedConfig.DATA_SOURCE += `/${loadedConfig.ICUBE_SOURCE}/${loadedConfig.ICUBE_PATH}`;
          loadedConfig.FILE_DIR = loadedConfig.ICUBE_HELP_DIR;
          break;
        case 'DWEZ':
          loadedConfig.DATA_SOURCE += `/${loadedConfig.DWEZ_SOURCE}/${loadedConfig.DWEZ_PATH}`;
          loadedConfig.FILE_DIR = loadedConfig.DWEZ_HELP_DIR;
          break;
        case 'ELO_KB':
          loadedConfig.DATA_SOURCE += `/${loadedConfig.ELO_KB_SOURCE}/${loadedConfig.ELO_KB_PATH}`;
          loadedConfig.FILE_DIR = loadedConfig.ELO_KB_DIR;
          break;
      }
    }

    return loadedConfig;
  } catch (error) {
    console.error(`loadconfig() Error:\n${error}`);
    throw error;
  }
}
