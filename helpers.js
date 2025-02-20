// Imports
import fs from 'node:fs/promises';
import path from 'node:path';
import logger from './logger.js';

/**
 * Namespace for configuration elements
 * @namespace configuration
 */

/**
 * Namespace for all elements related to file opearations
 * @namespace fileOperations
 */

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
