import preset from '@musichub/config/vitest/node';
import { defineConfig, mergeConfig } from 'vitest/config';

// MHD is the foundation of the music engine: keep coverage of the model at 90 % or more.
export default mergeConfig(
  preset,
  defineConfig({
    test: {
      coverage: { thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 } },
    },
  }),
);
