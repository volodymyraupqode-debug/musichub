// Spike S6: tests of the measurement maths with synthetic event streams of known jitter, drift
// and latency, so every metric is checked against a value computed by hand.
import { describe, expect, it } from 'vitest';
import {
  anchorMetrics,
  clockError,
  contextClockResidual,
  contextToPage,
  expectedInterval,
  fitLine,
  histogram,
  intervalMetrics,
  loopbackErrors,
  percentile,
  steadyState,
  summarize,
  wander,
  type PositionSample,
} from './analysis.ts';

/** Deterministic pseudo-random numbers (LCG) in [0, 1). */
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Reports every `step` ms of audio; arrival = offset + position / rate + delay. */
function stream(
  n: number,
  step: number,
  offset: number,
  rate: number,
  delay: (i: number) => number,
) {
  return Array.from({ length: n }, (_, i): PositionSample => ({
    position: i * step,
    arrival: offset + (i * step) / rate + delay(i),
    isSeek: false,
  }));
}

describe('percentile and summary', () => {
  it('uses the nearest rank', () => {
    const v = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(v, 0.5)).toBe(50);
    expect(percentile(v, 0.95)).toBe(95);
    expect(percentile(v, 0.99)).toBe(99);
    expect(percentile([7], 0.99)).toBe(7);
    expect(summarize([3, 1, 2])).toEqual({ count: 3, median: 2, p95: 3, p99: 3, max: 3, min: 1 });
    expect(() => percentile([], 0.5)).toThrow();
  });
});

describe('expected interval', () => {
  it('rounds the interval up to whole 128-frame render quanta', () => {
    expect(expectedInterval(10, 48_000)).toBeCloseTo((512 / 48_000) * 1000, 9); // 480 → 4 quanta
    expect(expectedInterval(10, 44_100)).toBeCloseTo((512 / 44_100) * 1000, 9); // 441 → 4 quanta
    expect(expectedInterval(0, 48_000)).toBeCloseTo((128 / 48_000) * 1000, 9);
    expect(expectedInterval(20, 48_000)).toBeCloseTo((1024 / 48_000) * 1000, 9); // 960 → 8 quanta
  });
});

describe('fitLine', () => {
  it('recovers slope and intercept', () => {
    const xs = [0, 1, 2, 3, 4];
    expect(
      fitLine(
        xs,
        xs.map((x) => 5 + 2 * x),
      ),
    ).toEqual({ a: 5, b: 2 });
  });
});

describe('interval metrics', () => {
  it('counts delayed intervals and missed slots', () => {
    const samples = [0, 10, 20, 50, 60].map((arrival, i) => ({
      arrival,
      position: i * 10,
      isSeek: false,
    }));
    const m = intervalMetrics(samples, 10);
    expect(m.interval.count).toBe(4);
    expect(m.interval.max).toBe(30);
    expect(m.deviation.max).toBe(20);
    expect(m.delayed).toBe(1);
    expect(m.missedSlots).toBe(2);
  });
});

describe('anchor metrics', () => {
  it('separates constant latency and drift from jitter', () => {
    const rnd = random(1);
    // 120 ms constant offset, 100 ppm fast audio clock, uniform 0–4 ms arrival delay.
    const s = stream(6000, 10, 120, 1.0001, () => rnd() * 4);
    const m = anchorMetrics(s, 1);
    // The fitted rate carries estimation error from the jitter: ±5 ppm over 60 s.
    expect(Math.abs(m.driftPpm - 100)).toBeLessThan(5);
    expect(m.jitter.p95).toBeGreaterThan(1.6);
    expect(m.jitter.p95).toBeLessThan(2.1); // |U(0,4) − 2| has p95 = 1.9
    // A constant offset alone never shows up as jitter.
    const constant = anchorMetrics(
      stream(1000, 10, 500, 1, () => 0),
      1,
    );
    expect(constant.jitter.max).toBeLessThan(1e-6);
    expect(constant.driftPpm).toBeCloseTo(0, 6);
  });

  it('reports a delayed burst as jitter, not as drift', () => {
    const s = stream(3000, 10, 0, 1, (i) => (i % 500 === 0 ? 40 : 0));
    const m = anchorMetrics(s, 1);
    expect(m.jitter.max).toBeGreaterThan(39);
    expect(m.jitter.p95).toBeLessThan(0.5);
    expect(Math.abs(m.driftPpm)).toBeLessThan(10);
  });
});

describe('clock models', () => {
  const rnd = random(7);
  const samples = stream(3000, 10, 50, 1, () => rnd() * 6);
  const anchor = anchorMetrics(samples, 1);
  const frames = Array.from({ length: 1700 }, (_, j) => 100 + j * 16.6667);

  it('interpolation removes the step error of the raw position', () => {
    const raw = clockError('raw', samples, frames, anchor, 1);
    const interpolated = clockError('interpolated', samples, frames, anchor, 1);
    expect(raw.error.p95).toBeGreaterThan(interpolated.error.p95);
    expect(interpolated.error.p95).toBeLessThan(4);
  });

  it('a regression window smooths arrival jitter further', () => {
    const interpolated = clockError('interpolated', samples, frames, anchor, 1);
    const regression = clockError('regression', samples, frames, anchor, 1);
    expect(regression.error.p95).toBeLessThan(interpolated.error.p95);
  });

  it('is exact without jitter', () => {
    const clean = stream(1000, 10, 0, 1, () => 0);
    const a = anchorMetrics(clean, 1);
    const e = clockError('interpolated', clean, [15, 105.5, 5000.25], a, 1);
    expect(e.error.max).toBeLessThan(1e-6);
  });
});

describe('steady state', () => {
  it('drops the first second, the last half second and seeks', () => {
    const s = stream(300, 10, 0, 1, () => 0);
    s[150] = { ...(s[150] as PositionSample), isSeek: true };
    const steady = steadyState(s);
    expect(steady[0]?.arrival).toBe(1000);
    expect(steady[steady.length - 1]?.arrival).toBe(2490);
    expect(steady.some((x) => x.isSeek)).toBe(false);
  });
});

describe('loopback', () => {
  it('splits a constant latency from jitter of recorded onsets', () => {
    const rnd = random(3);
    const samples = stream(12_000, 10, 0, 1, () => 0);
    // Notes every 500 ms; each recorded 35 ms after it played, ±1.5 ms.
    const onsets = Array.from({ length: 200 }, (_, k) => k * 500 + 35 + (rnd() - 0.5) * 3);
    const r = loopbackErrors('interpolated', samples, onsets, 500, 1);
    expect(r.matched).toBe(200);
    expect(r.latency).toBeCloseTo(35, 0);
    expect(r.jitter.p95).toBeLessThan(1.6);
  });

  it('maps context time to page time with a fitted line', () => {
    const pairs = [0, 1, 2, 3].map((c) => [c, 1000 + c * 1000 + 0.5] as const);
    expect(contextToPage(pairs, [1.5])[0]).toBeCloseTo(2500.5, 6);
  });
});

describe('histogram', () => {
  it('bins values and collects the overflow in the last bin', () => {
    expect(histogram([0, 0.4, 0.5, 1.2, 9], 0.5, 1.5)).toEqual([
      [0, 2],
      [0.5, 1],
      [1, 1],
      [1.5, 1],
    ]);
  });
});

describe('wander', () => {
  it('stays flat for white delivery jitter and follows a wandering timeline', () => {
    const rnd = random(11);
    const white = stream(6000, 10, 0, 1, () => rnd() * 8);
    expect(wander(white, anchorMetrics(white, 1)).range).toBeLessThan(1);
    // ±10 ms sine wander with a 10 s period, plus the same delivery jitter.
    const wavy = stream(
      6000,
      10,
      0,
      1,
      (i) => 10 * Math.sin((2 * Math.PI * i * 10) / 10_000) + rnd() * 8,
    );
    expect(wander(wavy, anchorMetrics(wavy, 1)).range).toBeGreaterThan(15);
  });

  it('measures the context clock residual', () => {
    const pairs = Array.from({ length: 100 }, (_, i) => [i / 100, i * 10 + (i % 2) * 2] as const);
    expect(contextClockResidual(pairs)).toBeCloseTo(1, 1);
  });
});
