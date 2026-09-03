import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', 'playwright-report/**', 'test-results/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      ecmaVersion: 2022,
      sourceType: 'script',
    },
    rules: {
      'no-unused-vars': ['error', { args: 'all', argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['tests/**/*.js', 'playwright.config.js', 'eslint.config.js', '**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
];
