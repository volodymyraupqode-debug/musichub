import { spikeConfig } from '@musichub/config/eslint/spike';
import { defineConfig } from 'eslint/config';
import globals from 'globals';

export default defineConfig(spikeConfig(import.meta.dirname), {
  languageOptions: { globals: { ...globals.node } },
});
