// Spike S6 smoke test: the harness plays, records position events, and the event interval
// follows the configured positionUpdateIntervalInMilliseconds. Not a measurement (see measure.spec.ts).
import { expect, test } from '@playwright/test';
import {
  expectedInterval,
  intervalMetrics,
  steadyState,
  type PositionSample,
} from '../src/analysis.ts';
import { startHarnessServer, type HarnessServer } from '../harness/server.ts';
import { runHarness } from './run.ts';

let server: HarnessServer;
test.beforeAll(async () => {
  server = await startHarnessServer();
});
test.afterAll(async () => {
  await server.close();
});

for (const interval of [10, 0]) {
  test(`records position events at interval ${interval} ms`, async ({ page }) => {
    test.setTimeout(120_000);
    const raw = await runHarness(page, server.origin, { interval, speed: 1, seconds: 6 });
    expect(raw.meta.errors).toEqual([]);
    const output = raw.meta.output as { sampleRate: number } | null;
    expect(output?.sampleRate).toBeGreaterThan(0);
    const samples: PositionSample[] = raw.events.map((e) => ({
      arrival: e[0] ?? 0,
      position: e[1] ?? 0,
      isSeek: e[3] === 1,
    }));
    const steady = steadyState(samples);
    expect(steady.length).toBeGreaterThan(100);
    const expected = expectedInterval(interval, output?.sampleRate ?? 48_000);
    const m = intervalMetrics(steady, expected);
    test.info().annotations.push({ type: 'interval', description: JSON.stringify(m) });
    // Loose bound on the mean interval: a smoke check of the setting, not the jitter criterion.
    // (With 0 ms Chromium delivers render quanta in pairs, so the median is not the interval.)
    const first = steady[0] as PositionSample;
    const last = steady[steady.length - 1] as PositionSample;
    const mean = (last.arrival - first.arrival) / (steady.length - 1);
    expect(m.interval.count).toBe(steady.length - 1);
    expect(mean).toBeGreaterThan(expected * 0.7);
    expect(mean).toBeLessThan(expected * 1.5);
  });
}
