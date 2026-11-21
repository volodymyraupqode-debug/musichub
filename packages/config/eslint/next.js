// Next.js layer: react layer + @next/eslint-plugin-next (recommended + Core Web Vitals).
// Usage: `import next from '@musichub/config/eslint/next';`
import nextPlugin from '@next/eslint-plugin-next';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import react from './react.js';

export default defineConfig(react, {
  plugins: { '@next/next': nextPlugin },
  languageOptions: { globals: { ...globals.node } },
  rules: {
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs['core-web-vitals'].rules,
  },
});
