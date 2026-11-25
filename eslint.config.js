// ESLint flat config: browser code in js/, Node tools/tests. Vendored libraries and Deno functions are skipped.
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'js/vendor/**', 'supabase/functions/**', 'supabase/.temp/**'] },
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        module: 'readonly',
        globalThis: 'readonly',
        UI: 'readonly',
        I18N: 'readonly',
        CF_API: 'readonly',
        CF_CONFIG: 'readonly',
        CF_SEED: 'readonly',
        qrcode: 'readonly',
        Html5Qrcode: 'readonly'
      }
    },
    rules: { 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }], 'no-empty': ['error', { allowEmptyCatch: true }] }
  },
  {
    files: ['tools/**/*.js', 'tests/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser, CF_API: 'readonly', UI: 'readonly' } },
    rules: { 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }] }
  }
];
