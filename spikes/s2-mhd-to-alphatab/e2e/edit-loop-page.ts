// Spike S3: opens the edit-loop harness in a Playwright page (shared by the smoke and measure specs).
import type { Page } from '@playwright/test';

export async function openHarness(
  page: Page,
  origin: string,
  doc: string,
  variant = 'baseline',
  caret?: 'first',
) {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${origin}/?doc=${doc}&variant=${variant}${caret ? `&caret=${caret}` : ''}`);
  await page.waitForFunction('window.__s3 !== undefined', undefined, { timeout: 120_000 });
  return pageErrors;
}
