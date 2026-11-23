import { defineConfig, devices } from '@playwright/test';

const PORT = 3210;

// Spike S1 smoke: Chromium and WebKit. WebKit is Playwright's engine build, not Safari;
// Safari, Firefox and audible sound are checked by hand (docs/spikes/s1-turbopack.md).
export default defineConfig({
  testDir: './e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    // Requires a production build (`turbo run test:e2e` builds first).
    command: `pnpm exec next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
