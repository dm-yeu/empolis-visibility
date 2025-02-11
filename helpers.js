// Imports
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'url';
import logger from './logger.js';
import yaml from 'js-yaml';
import { select } from '@inquirer/prompts';

/**
 * Namespace for configuration elements
 * @namespace configuration
 */

/**
 * Namespace for all elements related to file opearations
 * @namespace fileOperations
 */

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load configuration from YAML file
 * @async
 * @function loadConfig
 * @memberof configuration
 * @param {boolean} [ promptUser = false ] - Prompt user for configuration data
 * @returns {Promise<Object>} Parsed configuration object
 */

export async function loadConfig({ promptUser = false }) {
  try {
    // Build the absolute path to the config.yaml file
    const configPath = path.join(__dirname, 'config.yaml');
    // Read the YAML file
    const fileContents = await fs.readFile(configPath, 'utf8');
    // Parse YAML to JavaScript object
    const config = yaml.load(fileContents);
    // Return the configuration object if promptUser is false
    if (!promptUser) return config;

    // Prompt user for data source selection
    config.dataSourceSelection = await select({
      message: 'Select the data source:',
      choices: [
        { name: 'iCube', value: 'iCube', description: 'Help files for iCube Engineer' },
        { name: 'DWEZ', value: 'DWEZ', description: 'Help files for DriveWorks EZ' },
      ],
    });
    // Configure the data source based on user selection
    switch (config.dataSourceSelection) {
      case 'iCube':
        config.DATA_SOURCE = config.ICUBE_DATA_SOURCE;
        config.FILE_DIR = config.ICUBE_HELP_DIR;
        break;
      case 'DWEZ':
        config.DATA_SOURCE = config.DWEZ_DATA_SOURCE;
        config.FILE_DIR = config.DWEZ_HELP_DIR;
        break;
    }

    // Prompt user to select the operation to perform on the data source
    config.OPERATION = await select({
      message: 'Select the operation to perform on the data source:',
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
          name: 'Search the data source',
          value: 'search',
          description: 'Search the data source for a specific file',
        },
      ],
    });

    return config;
  } catch (error) {
    console.error(`loadconfig() Error:\n${error}`);
    throw error;
  }
}

/**
 * Function to get all the filenames with .html or .htm ending from a specified directory.
 * @async
 * @function getHtmlFiles
 * @memberof fileOperations
 * @param {string} directory - location of the directory to get filenames from
 * @returns {Promise<array>} Array with all .html and .htm filenames, empty if no .html or .htm files found
 */

export async function getHtmlFiles(directory) {
  try {
    let files = await fs.readdir(directory);
    files = files.filter(
      (file) =>
        path.extname(file).toLowerCase() === '.html' || path.extname(file).toLowerCase() === '.htm'
    );
    if (files.length === 0) throw new Error(`No HTML files found in ${directory}`);
    return files;
  } catch (error) {
    logger.error(`getHtmlFiles() Error:\n${error}`);
    throw new Error(`Failed to get HTML files: ${error.message}`);
  }
}

/** Check if a file or directory exists
 * @async
 * @function fileExists
 * @memberof fileOperations
 * @param {string} filePath - path of the file or directory
 * @returns {Promise<boolean>} TRUE if the file or directory exists, FALSE if not
 * @requires fs.access
 * @requires logger
 */

export async function fileExists(filePath) {
  try {
    await fs.access(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    logger.error(`fileExists() Error:\n${error}`);
    return false;
  }
}

/** Delete all content from the specified file
 * @async
 * @function truncateFile
 * @memberof fileOperations
 * @param {string} filePath - path of the file to be emptied
 * @returns {Promise<null>}
 * @requires fs.truncate
 * @requires logger
 */

export async function truncateFile(filePath) {
  try {
    await fs.truncate(filePath, 0);
    logger.debug(`truncateFile():\n${filePath} truncated successfully.`);
    return null;
  } catch (err) {
    logger.error(`Error truncating ${filePath}:\n`, err);
  }
}

export async function readJsonData(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const jsonData = JSON.parse(data);
    logger.info(`JSON data read from ${filePath}`);
    return jsonData;
  } catch (error) {
    logger.error('readJsonData() Error:', error);
  }
}
