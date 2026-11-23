import { spikeConfig } from '@musichub/config/eslint/spike';
import { defineConfig } from 'eslint/config';
import globals from 'globals';

export default defineConfig(
  spikeConfig(import.meta.dirname),
  // Copied alphaTab runtime, generated at dev/build time.
  { ignores: ['public/alphatab/**'] },
  { files: ['src/**/*.{ts,tsx}'], languageOptions: { globals: { ...globals.browser } } },
  {
    files: ['scripts/**/*.mjs', '*.ts', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
