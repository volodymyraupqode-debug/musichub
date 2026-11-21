// Vitest preset for pure TypeScript packages (Node environment, v8 coverage).
// Usage in vitest.config.ts: `export { default } from '@musichub/config/vitest/node';`
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'html'], include: ['src/**'] },
  },
});
