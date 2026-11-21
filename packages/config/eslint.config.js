// Shared ESLint flat config for all TypeScript packages and apps.
// Usage in a package: `export { default } from '@musichub/config/eslint';`
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
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
