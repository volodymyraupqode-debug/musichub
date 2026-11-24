import { defineConfig, devices } from '@playwright/test';

// Spike S6. `pnpm test:browser` runs a short smoke test; `pnpm measure` collects the raw
// measurements (long, one browser run at a time). Neither is part of `turbo run test` or CI.
// WebKit is Playwright's engine build, not Safari; Firefox is Playwright's build.
export default defineConfig({
  testDir: './e2e',
  reporter: 'list',
  use: { trace: 'off' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
      },
    },
    // Firefox: Playwright's Firefox build is not installed here (`pnpm exec playwright install
    // firefox` downloads it); add `{ name: 'firefox', use: devices['Desktop Firefox'] }` then.
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
