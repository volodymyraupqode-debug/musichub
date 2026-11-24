import { defineConfig, devices } from '@playwright/test';

// Spike S7 browser experiment (e2e/s7-browser.spec.ts). Run by hand with `pnpm test:browser`;
// not part of `turbo run test` or CI. WebKit is Playwright's engine build, not Safari.
export default defineConfig({
  testDir: './e2e',
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
      },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
