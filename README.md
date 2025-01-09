# Help File Metadata Update in Empolis

Several help files (iCube Engineer, DriveWorks EZ) are integrated as data sources in Empolis via the Empolis Box. The metadata of the HTML files must be adapted in Empolis to be human readable, and improve search results.

This project reads specified tags from the HTML sources, and updates the metadata of the corresponding file in Empolis via the API.

## Files

- `index.js` --> main
- `empolis_functions.js` --> functions that interface to Empolis
- `helpers.js` --> helper functions
- `logger.js` --> 'winston' logger configuration
- `.env` --> environment variables such as username, password, clientID, and clientSecret

## Modules

Documented via jsdoc (see HTML in `./jsdoc`).

## Authentication

### Empolis API

Authentication with the Empolis API is handled via the [*Resource Owner Password Credentials Grant*](https://yaskawa2.esc-eu-central-1.empolisservices.com/doc/en/getting-started/api-authorization#curl-resource-owner-password-credentials-grant) method.

## Backlog

- Implement configuration validation
- Implement batch processing for parallel file handling
- Unit testing (Jest or Mocha)