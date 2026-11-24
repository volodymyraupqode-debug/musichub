import { defineConfig } from 'vitest/config';

// Spike S6: unit tests of the measurement maths (Node). Browser runs: e2e/ (Playwright).
export default defineConfig({ test: { environment: 'node', include: ['src/**/*.test.ts'] } });
