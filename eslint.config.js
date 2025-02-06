import globals from 'globals';
import pluginJs from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    languageOptions: { globals: globals.node },
  },
  {
    ignores: ['node_modules/', 'jsdoc/', 'schema_samples/'],
  },
  pluginJs.configs.recommended,
  eslintConfigPrettier,
];
