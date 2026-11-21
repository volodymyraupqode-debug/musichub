// Vitest preset for DOM/React code (jsdom environment, v8 coverage).
// Usage in vitest.config.ts: `export { default } from '@musichub/config/vitest/jsdom';`
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: { provider: 'v8', reporter: ['text', 'html'], include: ['src/**'] },
  },
});
