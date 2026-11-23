import { expect, test, type Page } from '@playwright/test';

type Probes = {
  scoreTracks: number;
  scoreMasterBars: number;
  renderedTracks: number;
  renderFinished: number;
  workers: string[];
  playerReady: boolean;
  theme: string;
  errors: string[];
};

const readProbes = (page: Page) =>
  page.evaluate(() => (window as unknown as { __s1: Probes }).__s1);

/** Fill and stroke colours used inside the alphaTab SVG output. */
const svgColors = (page: Page) =>
  page.evaluate(() => {
    const colors = new Set<string>();
    for (const element of document.querySelectorAll(
      '[data-testid=score] :is(text, path, rect, line)',
    )) {
      const value = element.getAttribute('fill') ?? element.getAttribute('stroke');
      if (value) colors.add(value.toUpperCase());
    }
    return [...colors];
  });

test('renders both tracks and switches the alphaTab theme', async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.locator('[data-testid=score] svg').first()).toBeVisible();
  await expect
    .poll(async () => (await readProbes(page)).renderFinished, { timeout: 20_000 })
    .toBeGreaterThan(0);

  const loaded = await readProbes(page);
  expect(loaded.scoreTracks).toBe(2);
  expect(loaded.scoreMasterBars).toBe(12);
  expect(loaded.renderedTracks).toBe(2);
  expect(await svgColors(page)).toContain('#1F2328');

  await page.getByTestId('theme').click();
  await expect
    .poll(async () => (await readProbes(page)).renderFinished)
    .toBeGreaterThan(loaded.renderFinished);
  const dark = await svgColors(page);
  expect(dark).toContain('#E6EDF3');
  expect(dark).not.toContain('#1F2328');

  const final = await readProbes(page);
  testInfo.annotations.push(
    { type: 'workers', description: String(final.workers.length) },
    { type: 'playerReady', description: String(final.playerReady) },
  );
  expect(final.errors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
