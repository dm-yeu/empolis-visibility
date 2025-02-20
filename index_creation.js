import fs from 'fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { getConfig } from './config.js';
import logger from './logger.js';
import { fileExists, getHtmlFiles, truncateFile } from './helpers.js';

/**
 * Namespace for functions used to extract text from HTML files and create a file index
 * @namespace fileIndex
 */

/**
 * Create or update an index file with all source files contained in the original data source
 * @async
 * @function createUpdateIndexFile
 * @memberof fileIndex
 * @requires confirm
 * @requires helpers
 * @requires index_creation
 * @returns {Promise<Object>} Object containing the list of files as an array, and the index file path
 */
export async function createUpdateIndexFile() {
  try {
    const config = getConfig();
    // Prompt user to confirm the directory for the source files of the data source
    config.OK = await confirm({
      message: `The directory for the files of data source '${config.dataSourceSelection}' is '${config.FILE_DIR}'. Continue?`,
    });

    // Throw error if user cancels the operation due to incorrect configuration
    if (!config.OK) {
      logger.info(`User cancelled the operation due to configuration errors`);
      console.log(
        `${chalk.red('X')}` +
          ` Operation cancelled. Check configuration in ${chalk.cyan('./config.yaml')}.`
      );
      throw new Error('Operation cancelled');
    }

    const fileList = await getHtmlFiles(config.FILE_DIR);
    console.log(
      `  Found ${chalk.cyan(fileList.length)} HTML files in data source directory. Creating index file...`
    );
    logger.info(
      `Found ${fileList.length} HTML files in data source directory. Creating index file.`
    );
    const indexFile = await createFileIndex({
      directoryPath: config.FILE_DIR,
      fileList,
    });
    console.log(
      `${chalk.green('√')}` +
        ` Index file for '${config.dataSourceSelection}' source data created at ${chalk.cyan(indexFile)}`
    );
    logger.info(
      `Index file for '${config.dataSourceSelection}' source data created at ${indexFile}`
    );
    return { fileList, indexFile };
  } catch (error) {
    if (error.message === 'Operation cancelled') {
      return { fileList: [], indexFile: '' };
    } else {
      logger.error(`createUpdateIndexFile() Error:\n${error}`);
      throw new Error(`Failed to create index file: ${error.message}`);
    }
  }
}

/** Creates a JSON index of all files in a specified directory and saves it to a file
 * <br> The index includes the filename, title, and breadcrumbs (optional) extracted from the HTML contents
 * @async
 * @function createFileIndex
 * @memberof fileIndex
 * @param {string} directoryPath - path of directory containing files to be indexed
 * @param {Array} fileList - filenames of files to be indexed
 * @returns {Promise<string>} The path of the index file if successful
 * @requires path.join
 * @requires fileExists
 * @requires fs.mkdir
 * @requires truncateFile
 * @requires logger
 */

export async function createFileIndex({ directoryPath, fileList }) {
  logger.debug(`directoryPath: ${directoryPath}`);

  try {
    // Prepare index directory and file
    const indexDir = path.join(directoryPath, 'index');
    logger.debug(`indexDir: ${indexDir}`);
    const indexFile = path.join(indexDir, 'file_index.json');
    logger.debug(`indexFile: ${indexFile}`);

    // If the index directory does not exist, create it
    if (!(await fileExists(indexDir))) {
      await fs.mkdir(indexDir, { recursive: true });
      logger.info(`${indexDir} directory created for file index.`);
    }
    // If the index directory and the index file exist, empty the index file
    else if (await fileExists(indexFile)) {
      await truncateFile(indexFile);
    }

    for (const file of fileList) {
      const filePath = path.join(directoryPath, file);
      const titleAndBreadcrumbs = await extractTitleAndBreadcrumbs(filePath);
      await writeIndexFile({ newEntry: titleAndBreadcrumbs, indexFilePath: indexFile });
    }

    return indexFile;
  } catch (error) {
    logger.error(`createFileIndex() Error:\n${error}`);
  }
}

/** Extract title and breadcrumbs from HTML file content, and return as object with the filename
 * @async
 * @function extractTitleAndBreadcrumbs
 * @memberof fileIndex
 * @param {string} htmlFilePath - path of the HTML file
 * @returns {Promise<Object>} Filename, Title, and Breadcrumbs (optional) extracted from HTML file contents as JSON
 * @requires path.basename
 * @requires fs.readFile
 * @requires cheerio
 * @requires logger
 */

export async function extractTitleAndBreadcrumbs(htmlFilePath) {
  try {
    const filename = path.basename(htmlFilePath);
    const htmlContent = await fs.readFile(htmlFilePath, 'utf8');
    const $ = cheerio.load(htmlContent);

    // Try to get title from <title> tag first, then fall back to Heading_2
    let title = $('title').text().trim();
    if (!title) title = $('.Heading_2').text().trim();
    if (!title) title = 'Untitled';

    const breadcrumbs = $('.WebWorks_Breadcrumbs')
      .text()
      .trim()
      .split('>')
      .map((crumb) => crumb.trim());

    logger.info(`  Title ('${title}') and breadcrumbs extracted from '${filename}' and returned`);
    return {
      filename,
      title,
      ...(breadcrumbs.length > 0 && breadcrumbs[0].trim() !== '' && { breadcrumbs }),
    };
  } catch (error) {
    logger.error(`extractTitleAndBreadcrumbs() Error:\n${error}`);
  }
}

/** Write new entry to the file index
 * @async
 * @function writeIndexFile
 * @memberof fileIndex
 * @param {Object} newEntry - New entry for the file index
 * @param {string} indexFilePath - Path of the index file
 * @returns {Promise<null>}
 * @requires fs.readFile
 * @requires fs.writeFile
 * @requires logger
 */

async function writeIndexFile({ newEntry, indexFilePath }) {
  try {
    let jsonIndex = [];
    try {
      jsonIndex = JSON.parse(await fs.readFile(indexFilePath, 'utf8'));
    } catch {
      // If file doesn't exist or is invalid JSON, start with an empty index
      logger.info(`  ${indexFilePath} not found. Starting with empty index.`);
    }
    jsonIndex.push(newEntry);
    await fs.writeFile(indexFilePath, JSON.stringify(jsonIndex, null, 2));
    logger.info(`  ${JSON.stringify(newEntry)} added to index file.`);
    return null;
  } catch (error) {
    logger.error(`  Error writing to ${indexFilePath}:\n`, error);
  }
}
