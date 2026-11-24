// Spike S6: drives one harness run in a Playwright page and returns the raw data.
import type { Page } from '@playwright/test';

export interface RunConfig {
  interval: number;
  speed: number;
  seconds: number;
}

export interface RawRun {
  meta: Record<string, unknown> & { config: RunConfig; errors: string[] };
  events: number[][];
  frames: number[];
  contextPairs: number[][];
  outputTimestamps: number[][];
  onsets: number[][];
  inputPairs: number[][];
}

export async function runHarness(page: Page, origin: string, c: RunConfig): Promise<RawRun> {
  await page.goto(`${origin}/?interval=${c.interval}&speed=${c.speed}&seconds=${c.seconds}`);
  await page.waitForFunction('window.__s6?.status.phase === "ready"', undefined, {
    timeout: 60_000,
  });
  await page.click('#start'); // user gesture for the AudioContext
  await page.waitForFunction('window.__s6.status.done === true', undefined, {
    timeout: (c.seconds + 60) * 1000,
    polling: 1000,
  });
  return page.evaluate<RawRun>('window.__s6.raw');
}
