// Spike S6: computes the metrics of every raw run in data/raw/ (and data/loopback/, if any) and
// writes data/summary.json plus a Markdown table to stdout. Formulas: src/analysis.ts and
// docs/spikes/s6-audio-clock-accuracy.md §4. Usage: `pnpm analyze`.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
  anchorMetrics,
  clockError,
  contextClockResidual,
  contextToPage,
  expectedInterval,
  histogram,
  intervalMetrics,
  loopbackErrors,
  steadyState,
  summarize,
  wander,
  type PositionSample,
} from '../src/analysis.ts';

interface Raw {
  meta: {
    config: { interval: number; speed: number; seconds: number; loopback?: boolean };
    noteMs: number;
    userAgent: string;
    output: { sampleRate: number; baseLatency: number | null; outputLatency: number | null } | null;
    run?: { browser: string; project: string; repeat: number; headless: boolean };
    errors: string[];
  };
  events: number[][];
  frames: number[];
  contextPairs: number[][];
  outputTimestamps: number[][];
  onsets: number[][];
  inputPairs: number[][];
}

const DATA = path.join(import.meta.dirname, '../data');
const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

function load(file: string): Raw {
  const buffer = readFileSync(file);
  const text = file.endsWith('.gz') ? gunzipSync(buffer).toString('utf8') : buffer.toString('utf8');
  return JSON.parse(text) as Raw;
}

function analyze(name: string, raw: Raw) {
  const all: PositionSample[] = raw.events.map((e) => ({
    arrival: e[0] ?? 0,
    position: e[1] ?? 0,
    isSeek: e[3] === 1,
  }));
  const steady = steadyState(all);
  const sampleRate = raw.meta.output?.sampleRate ?? 48_000;
  const { interval, speed } = raw.meta.config;
  const expected = expectedInterval(interval, sampleRate);
  // alphaTab's currentTime advances by played audio milliseconds × playback speed? Measured: the
  // nominal rate is chosen as the closer of 1 and `speed` to the fitted rate, and reported.
  const fitted = anchorMetrics(steady, 1).rate;
  const nominalRate = Math.abs(fitted - speed) < Math.abs(fitted - 1) ? speed : 1;
  const anchor = anchorMetrics(steady, nominalRate);
  const first = steady[0] as PositionSample;
  const last = steady[steady.length - 1] as PositionSample;
  const frames = raw.frames.filter((t) => t >= first.arrival && t <= last.arrival);
  const clocks = Object.fromEntries(
    (['raw', 'interpolated', 'regression'] as const).map((m) => [
      m,
      clockError(m, steady, frames, anchor, nominalRate),
    ]),
  );
  // Fallback candidates (evaluated after the planned configurations failed in WebKit): longer
  // regression windows. Same reference, same frames.
  const regressionWindows = Object.fromEntries(
    [250, 500, 1000, 2000].map((w) => [
      w,
      clockError('regression', steady, frames, anchor, nominalRate, w),
    ]),
  );
  const advance: number[] = [];
  for (let i = 1; i < steady.length; i++)
    advance.push(
      (steady[i] as PositionSample).position - (steady[i - 1] as PositionSample).position,
    );
  const deltas: number[] = [];
  for (let i = 1; i < steady.length; i++)
    deltas.push((steady[i] as PositionSample).arrival - (steady[i - 1] as PositionSample).arrival);
  // Full interval distribution: 0.5 ms bins up to 3 E (everything above in the last bin).
  const intervalHistogram = histogram(deltas, 0.5, Math.max(3 * expected, 5)).filter(
    ([, c]) => c > 0,
  );
  // Timer resolution actually seen in the data: the smallest non-zero difference between arrivals.
  const resolution = Math.min(...deltas.filter((d) => d > 0));
  const coalesced = advance.filter((d) => d > 1.5 * expected * nominalRate).length;
  const n = Math.min(raw.contextPairs.length, raw.outputTimestamps.length);
  const reportedLag: number[] = [];
  for (let j = 0; j < n; j++) {
    const c = raw.contextPairs[j]?.[0] ?? -1;
    const o = raw.outputTimestamps[j]?.[0] ?? -1;
    if (c >= 0 && o > 0) reportedLag.push((c - o) * 1000);
  }
  let loopback: ReturnType<typeof loopbackErrors> | undefined;
  if (raw.onsets.length > 0 && raw.inputPairs.length > 1) {
    const onsetTimes = contextToPage(
      raw.inputPairs.map((p) => [p[0] ?? 0, p[1] ?? 0] as const),
      raw.onsets.map((o) => o[0] ?? 0),
    ).filter((t) => t >= first.arrival && t <= last.arrival);
    loopback = loopbackErrors('interpolated', steady, onsetTimes, raw.meta.noteMs, nominalRate);
  }
  return {
    name,
    browser: raw.meta.run?.project ?? 'manual',
    config: raw.meta.config,
    repeat: raw.meta.run?.repeat ?? null,
    headless: raw.meta.run?.headless ?? false,
    userAgent: raw.meta.userAgent,
    sampleRate,
    errors: raw.meta.errors,
    events: all.length,
    steadyEvents: steady.length,
    durationS: round(anchor.durationMs / 1000, 1),
    frames: frames.length,
    expectedMs: round(expected),
    intervals: intervalMetrics(steady, expected),
    intervalHistogram,
    zeroIntervals: deltas.filter((d) => d === 0).length,
    timerResolutionMs: round(resolution, 4),
    coalesced,
    nominalRate,
    fittedRate: round(fitted, 6),
    driftPpm: round(anchor.driftPpm, 1),
    driftOverRunMs: round(anchor.driftOverRunMs, 2),
    jitter: anchor.jitter,
    wander1s: wander(steady, anchor, 1000),
    contextClockResidualP95:
      raw.contextPairs.length > 10
        ? round(
            contextClockResidual(
              raw.contextPairs
                .filter((p) => (p[0] ?? 0) > 0)
                .map((p) => [p[0] ?? 0, p[1] ?? 0] as const),
            ),
            2,
          )
        : null,
    clocks,
    regressionWindows,
    browserReported: {
      baseLatencyMs:
        raw.meta.output?.baseLatency == null ? null : round(raw.meta.output.baseLatency * 1000, 2),
      outputLatencyMs:
        raw.meta.output?.outputLatency == null
          ? null
          : round(raw.meta.output.outputLatency * 1000, 2),
      outputTimestampLag: reportedLag.length > 0 ? summarize(reportedLag) : null,
    },
    loopback: loopback ?? null,
  };
}

const runs: ReturnType<typeof analyze>[] = [];
for (const dir of ['raw', 'loopback']) {
  const folder = path.join(DATA, dir);
  if (!existsSync(folder)) continue;
  for (const file of readdirSync(folder)
    .filter((f) => /\.json(\.gz)?$/.test(f))
    .sort())
    runs.push(analyze(`${dir}/${file}`, load(path.join(folder, file))));
}
writeFileSync(path.join(DATA, 'summary.json'), JSON.stringify(runs, null, 2) + '\n');

const f = (v: number) => v.toFixed(2);
console.log(
  '| Run | Browser | Interval | Speed | Dur s | Steady events | E ms | Δa median / p95 / p99 / max | |Δa−E| median / p95 / p99 / max | Delayed (missed slots) | Jitter median / p95 / p99 / max | Raw clock p95 | Interpolated p95 | Regression p95 | Drift ppm |',
);
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of runs) {
  const i = r.intervals;
  console.log(
    `| ${r.name} | ${r.browser} | ${r.config.interval} | ${r.config.speed} | ${r.durationS} | ${r.steadyEvents} | ${f(r.expectedMs)} | ${f(i.interval.median)} / ${f(i.interval.p95)} / ${f(i.interval.p99)} / ${f(i.interval.max)} | ${f(i.deviation.median)} / ${f(i.deviation.p95)} / ${f(i.deviation.p99)} / ${f(i.deviation.max)} | ${i.delayed} (${i.missedSlots}) | ${f(r.jitter.median)} / ${f(r.jitter.p95)} / ${f(r.jitter.p99)} / ${f(r.jitter.max)} | ${f(r.clocks.raw?.error.p95 ?? NaN)} | ${f(r.clocks.interpolated?.error.p95 ?? NaN)} | ${f(r.clocks.regression?.error.p95 ?? NaN)} | ${r.driftPpm} |`,
  );
}

// Across repeats of one configuration: range of the per-run statistics (samples are never pooled).
const groups = new Map<string, typeof runs>();
for (const r of runs.filter((x) => x.name.startsWith('raw/'))) {
  const key = `${r.browser} interval ${r.config.interval} speed ${r.config.speed} ${r.config.seconds}s`;
  groups.set(key, [...(groups.get(key) ?? []), r]);
}
const range = (v: number[]) =>
  v.length === 1 ? f(v[0] ?? NaN) : `${f(Math.min(...v))}–${f(Math.max(...v))}`;
console.log('');
console.log(
  '| Configuration | Runs | Jitter p95 (per-run range) | Jitter p99 | Jitter max | Interpolated p95 | Raw p95 | Drift ppm |',
);
console.log('|---|---|---|---|---|---|---|---|');
for (const [key, g] of groups)
  console.log(
    `| ${key} | ${g.length} | ${range(g.map((r) => r.jitter.p95))} | ${range(g.map((r) => r.jitter.p99))} | ${range(g.map((r) => r.jitter.max))} | ${range(g.map((r) => r.clocks.interpolated?.error.p95 ?? NaN))} | ${range(g.map((r) => r.clocks.raw?.error.p95 ?? NaN))} | ${range(g.map((r) => r.driftPpm))} |`,
  );

console.log('');
console.log(
  '| Run | Interpolated p95 / p99 | Regression 250 ms p95 / p99 | 500 ms | 1000 ms | 2000 ms |',
);
console.log('|---|---|---|---|---|---|');
for (const r of runs) {
  const w = (k: number) => {
    const e = r.regressionWindows[k];
    return e ? `${f(e.error.p95)} / ${f(e.error.p99)}` : 'n/a';
  };
  const i = r.clocks.interpolated;
  console.log(
    `| ${r.name} | ${i ? `${f(i.error.p95)} / ${f(i.error.p99)}` : 'n/a'} | ${w(250)} | ${w(500)} | ${w(1000)} | ${w(2000)} |`,
  );
}

console.log('');
console.log(
  '| Run | Jitter p95 | Wander (1 s lower-envelope range) | AudioContext.currentTime residual p95 |',
);
console.log('|---|---|---|---|');
for (const r of runs)
  console.log(
    `| ${r.name} | ${f(r.jitter.p95)} | ${f(r.wander1s.range)} | ${r.contextClockResidualP95 ?? 'n/a'} |`,
  );
