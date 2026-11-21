import { expect, test } from '@playwright/test';

// E2E_EXPECT_API=ok asserts a running API (local full stack); otherwise either state is accepted.
const expected = process.env.E2E_EXPECT_API;

test('homepage renders MusicHub with the API health status', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('MusicHub');
  await expect(page.getByRole('heading', { level: 1, name: 'MusicHub' })).toBeVisible();

  const health = page.getByTestId('api-health');
  if (expected === 'ok' || expected === 'unavailable') {
    await expect(health).toHaveText(`API: ${expected}`);
  } else {
    await expect(health).toHaveText(/^API: (ok|unavailable)$/);
  }
});
