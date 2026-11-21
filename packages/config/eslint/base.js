// Shared ESLint flat config (base layer) for every TypeScript package and app.
// Usage: `import base from '@musichub/config/eslint/base';`
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/src/generated/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.es2023 } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      // AGENT_RULES.md §4: only packages/music-engine may import alphaTab.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@coderline/alphatab', '@coderline/alphatab/*', '@coderline/alphatab-*'],
              message: 'Only packages/music-engine may import alphaTab (ARCHITECTURE.md §3.1).',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
