import next from '@musichub/config/eslint/next';
import { defineConfig } from 'eslint/config';

export default defineConfig(next, {
  settings: { next: { rootDir: import.meta.dirname } },
});
