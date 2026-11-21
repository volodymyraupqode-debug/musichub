// React layer: base + React, React Hooks and JSX accessibility rules.
// Usage: `import react from '@musichub/config/eslint/react';`
import { defineConfig } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import base from './base.js';

const reactRecommended = reactPlugin.configs.flat.recommended;
const reactJsxRuntime = reactPlugin.configs.flat['jsx-runtime'];
if (!reactRecommended || !reactJsxRuntime) {
  throw new Error('eslint-plugin-react flat configs not found; check the plugin version.');
}

export default defineConfig(base, {
  files: ['**/*.{jsx,tsx}'],
  extends: [
    reactRecommended,
    reactJsxRuntime,
    reactHooks.configs.flat['recommended-latest'],
    jsxA11y.flatConfigs.recommended,
  ],
  languageOptions: { globals: { ...globals.browser } },
  // Explicit version: eslint-plugin-react's 'detect' is broken on ESLint 10. Keep in sync with the react catalog entry.
  settings: { react: { version: '19.3' } },
  rules: {
    'react/prop-types': 'off',
  },
});
