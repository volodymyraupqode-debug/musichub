import jsdom from '@musichub/config/vitest/jsdom';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  jsdom,
  defineConfig({
    test: {
      exclude: ['e2e/**', 'node_modules/**'],
      // Next.js route files (src/app) are covered by Playwright, not by unit tests.
      coverage: { exclude: ['src/app/**', 'src/env.d.ts'] },
    },
  }),
);
