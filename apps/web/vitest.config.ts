import jsdom from '@musichub/config/vitest/jsdom';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  jsdom,
  defineConfig({ test: { exclude: ['e2e/**', 'node_modules/**'] } }),
);
