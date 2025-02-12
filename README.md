# Metadata Update in Empolis

Several data sources are integrated in Empolis via the Empolis Box.

- iCube Engineer Help File
- DriveWorks EZ Help File
- YEC Drives Technical Information Database
- YEC Drives Application Know-How Database
- ELO DMC Knowledge Base

The metadata of the files must be adapted in Empolis to be human readable, and improve search results. Additionally, visibility tags need to be set according to the configured access level.

This project extracts the relevant metadata from the files and updates it in Empolis via the API. Additionally, visibility tags can be set.

## Files

- `index.js` --> main
- `empolis_admin.js` --> administrative functions that interface to Empolis
- `empolis_ops.js` --> miscelaneous operations in Empolis
- `empolis_search.js` --> search operations in Empolis
- `index_creation.js` --> creation of index of all files in the data source
- `helpers.js` --> helper functions
- `logger.js` --> 'winston' logger configuration
- `.env` --> environment variables for secrets (.gitignore)
- `config.yaml` --> app configuration file
- `.prettierrc` --> prettier formatter configuration file
- `eslint.config.js` --> eslint linter configuration file

## Documentation

Documented via jsdoc (see HTML in `./jsdoc`).

## Authentication

### Empolis API

Authentication with the Empolis API is handled via the [_Resource Owner Password Credentials Grant_](https://yaskawa2.esc-eu-central-1.empolisservices.com/doc/en/getting-started/api-authorization#curl-resource-owner-password-credentials-grant) method.

## Backlog

- See [Github Issues](https://github.com/dm-yeu/empolis-visibility/issues)
