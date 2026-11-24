// Spike S6 follow-up: offline replay of the 18 recorded raw runs (data/raw) through the clock
// model (src/clock.ts). No browser, no new measurement. Writes data/clock-replay/summary.json and
// summary.md. Usage: `pnpm replay-clock`.
//
// Error definition (same reference as the S6 report §4): per run, a line arrival ≈ α + β·currentTime
// is fitted through the steady-state events (the audio-frame timeline). At every recorded animation
// frame t of the steady window the clock value C(t) (score ms) is compared with the reference
// R(t) = ((t − α) / β) · speed; error e(t) = (C(t) − R(t)) / speed in playback ms. Reported: bias =
// median(e) (a constant offset, not jitter), |e − bias| (median, p95, p99, max) and max |e|.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { anchorMetrics, percentile, steadyState, type PositionSample } from '../src/analysis.ts';
import { PlaybackClockModel, type ClockConfig, type ClockEvent } from '../src/clock.ts';

interface Raw {
  meta: {
    config: { interval: number; speed: number; seconds: number; bpm: number };
    noteMs: number;
    bars: number;
    states: [number, number, number][];
    run?: { project: string; repeat: number };
  };
  events: number[][];
  frames: number[];
}

const DATA = path.join(import.meta.dirname, '../data');
const OUT = path.join(DATA, 'clock-replay');
const SLEW_RATE = 0.1; // fixed before the replay (10 % of elapsed playback time)

export interface Variant {
  name: string;
  config: Omit<ClockConfig, 'endScoreMs'>;
  /** Exploratory variants are reported separately (§ tuning / held-out split). */
  exploratory?: boolean;
}

const VARIANTS: Variant[] = [
  {
    name: 'interpolation (snap every anchor)',
    config: { policy: 'snap', thresholdMs: 30, slewRate: SLEW_RATE },
  },
  ...[20, 30, 40].map((th) => ({
    name: `slew + snap ≥ ${th} ms`,
    config: { policy: 'slew' as const, thresholdMs: th, slewRate: SLEW_RATE },
  })),
  {
    name: 'slew, never snap',
    config: { policy: 'slew', thresholdMs: Infinity, slewRate: SLEW_RATE },
  },
  ...[0.05, 0.2].map((r) => ({
    name: `exploratory: slew ${r * 100} % + snap ≥ 30 ms`,
    config: { policy: 'slew' as const, thresholdMs: 30, slewRate: r },
    exploratory: true,
  })),
];

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

function replay(raw: Raw, variant: Variant) {
  const speed = raw.meta.config.speed;
  const endScoreMs = raw.meta.bars * 4 * raw.meta.noteMs; // noteMs: one quarter at speed 1
  const clock = new PlaybackClockModel({ ...variant.config, endScoreMs });
  // Inputs in time order; a state change at the same timestamp is applied before positions.
  type Input = { t: number; order: number; apply: () => void };
  const inputs: Input[] = [];
  raw.meta.states.forEach(([t, state, stopped], i) =>
    inputs.push({ t, order: i, apply: () => clock.setState(t, state === 1, stopped === 1) }),
  );
  raw.events.forEach((e, i) =>
    inputs.push({
      t: e[0] ?? 0,
      order: 1e6 + i,
      apply: () =>
        clock.position({
          t: e[0] ?? 0,
          currentTime: e[1] ?? 0,
          currentTick: e[2] ?? 0,
          isSeek: e[3] === 1,
          speed,
        }),
    }),
  );
  inputs.sort((a, b) => a.t - b.t || a.order - b.order);

  const samples: PositionSample[] = raw.events.map((e) => ({
    arrival: e[0] ?? 0,
    position: e[1] ?? 0,
    isSeek: e[3] === 1,
  }));
  const steady = steadyState(samples);
  const anchor = anchorMetrics(steady, 1);
  const from = (steady[0] as PositionSample).arrival;
  const to = (steady[steady.length - 1] as PositionSample).arrival;
  const frames = raw.frames.filter((t) => t >= from && t <= to);

  const errors: number[] = [];
  let k = 0;
  for (const t of frames) {
    while (k < inputs.length && (inputs[k] as Input).t <= t) (inputs[k++] as Input).apply();
    const c = clock.now(t);
    if (c.state !== 'playing') continue;
    const reference = ((t - anchor.intercept) / anchor.slope) * speed;
    errors.push((c.scoreMs - reference) / speed);
  }
  while (k < inputs.length) (inputs[k++] as Input).apply();

  const inWindow = (e: ClockEvent) => e.t >= from && e.t <= to;
  const snaps = clock.events.filter(
    (e): e is Extract<ClockEvent, { kind: 'snap' }> => e.kind === 'snap' && inWindow(e),
  );
  const applied = clock.events.filter(
    (e): e is Extract<ClockEvent, { kind: 'applied' }> => e.kind === 'applied' && inWindow(e),
  );
  const bias = percentile(errors, 0.5);
  const centred = errors.map((e) => Math.abs(e - bias)).sort((a, b) => a - b);
  const minutes = (to - from) / 60_000;

  // Periods without a valid anchor: waiting periods (play start / seek → first anchor) and gaps
  // between accepted anchors > 50 ms while playing.
  const accepted = clock.events
    .filter((e) => ['firstAnchor', 'snap', 'slew', 'applied'].includes(e.kind))
    .map((e) => e.t);
  const gaps: number[] = [];
  for (let i = 1; i < accepted.length; i++) {
    const g = (accepted[i] as number) - (accepted[i - 1] as number);
    if (g > 50) gaps.push(g);
  }
  const waits: number[] = [];
  let waitStart: number | undefined;
  for (const e of clock.events) {
    if (e.kind === 'seek') waitStart = e.t;
    if (e.kind === 'firstAnchor' && waitStart !== undefined) {
      waits.push(e.t - waitStart);
      waitStart = undefined;
    }
  }
  const playStart = raw.meta.states.find((s) => s[1] === 1)?.[0] ?? 0;
  const firstAnchor = clock.events.find((e) => e.kind === 'firstAnchor')?.t;

  return {
    frames: errors.length,
    bias: round(bias),
    median: round(percentile(centred, 0.5)),
    p95: round(percentile(centred, 0.95)),
    p99: round(percentile(centred, 0.99)),
    max: round(Math.max(...centred)),
    maxAbs: round(Math.max(...errors.map(Math.abs))),
    snaps: snaps.length,
    snapsPerMinute: round(snaps.length / minutes),
    maxSnapMs: snaps.length ? round(Math.max(...snaps.map((s) => Math.abs(s.jumpMs)))) : 0,
    correctionsAt:
      variant.config.policy === 'snap'
        ? Object.fromEntries(
            [5, 20, 30, 40].map((th) => [
              th,
              applied.filter((a) => Math.abs(a.deltaMs) >= th).length,
            ]),
          )
        : null,
    seeks: clock.events.filter((e) => e.kind === 'seek').length,
    startWaitMs: firstAnchor !== undefined ? round(firstAnchor - playStart) : null,
    seekWaits: waits.map((w) => round(w)),
    anchorGapsOver50ms: gaps.length,
    maxAnchorGapMs: gaps.length ? round(Math.max(...gaps)) : 0,
    rejectedDuplicates: clock.events.filter(
      (e) => e.kind === 'rejected' && e.reason === 'duplicate',
    ).length,
    rejectedOutOfOrder: clock.events.filter(
      (e) => e.kind === 'rejected' && e.reason === 'outOfOrder',
    ).length,
    windowMinutes: round(minutes, 3),
  };
}

const files = readdirSync(path.join(DATA, 'raw'))
  .filter((f) => f.endsWith('.json.gz'))
  .sort();
type Row = ReturnType<typeof replay> & {
  run: string;
  browser: string;
  interval: number;
  speed: number;
  seconds: number;
  variant: string;
  exploratory: boolean;
  split: 'tuning' | 'held-out';
};
const rows: Row[] = [];
for (const f of files) {
  const raw = JSON.parse(
    gunzipSync(readFileSync(path.join(DATA, 'raw', f))).toString('utf8'),
  ) as Raw;
  const c = raw.meta.config;
  const split = c.speed === 1 && c.seconds === 60 ? 'tuning' : 'held-out';
  for (const v of VARIANTS)
    rows.push({
      run: f.replace('.json.gz', ''),
      browser: raw.meta.run?.project ?? '?',
      interval: c.interval,
      speed: c.speed,
      seconds: c.seconds,
      variant: v.name,
      exploratory: v.exploratory === true,
      split,
      ...replay(raw, v),
    });
}

mkdirSync(OUT, { recursive: true });
writeFileSync(
  path.join(OUT, 'summary.json'),
  JSON.stringify({ slewRate: SLEW_RATE, variants: VARIANTS, rows }, null, 2) + '\n',
);

const f2 = (v: number) => v.toFixed(2);
const lines: string[] = [];
lines.push(
  'All values in playback ms. Error = |e − bias| at animation frames against the fitted audio-frame timeline; bias = median(e). Snaps counted in the steady window.',
  '',
);
lines.push('### Per run (main variants)', '');
lines.push(
  '| Run | Split | Variant | Frames | Bias | Median | p95 | p99 | Max | Max abs | Snaps | Snaps/min | Max snap |',
);
lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows.filter((x) => !x.exploratory))
  lines.push(
    `| ${r.run} | ${r.split} | ${r.variant} | ${r.frames} | ${f2(r.bias)} | ${f2(r.median)} | ${f2(r.p95)} | ${f2(r.p99)} | ${f2(r.max)} | ${f2(r.maxAbs)} | ${r.snaps} | ${f2(r.snapsPerMinute)} | ${f2(r.maxSnapMs)} |`,
  );

lines.push('', '### Per browser and interval (pooled runs; worst run in brackets)', '');
lines.push(
  '| Browser | Interval | Variant | Runs | Frames | p95 range over runs | worst p99 | worst max | Snaps total | Snaps/min (worst run) | Max snap |',
);
lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
const groups = new Map<string, Row[]>();
for (const r of rows.filter((x) => !x.exploratory))
  groups.set(`${r.browser}|${r.interval}|${r.variant}`, [
    ...(groups.get(`${r.browser}|${r.interval}|${r.variant}`) ?? []),
    r,
  ]);
for (const [key, g] of groups) {
  const [browser, interval, variant] = key.split('|');
  const p95s = g.map((r) => r.p95);
  lines.push(
    `| ${browser} | ${interval} | ${variant} | ${g.length} | ${g.reduce((n, r) => n + r.frames, 0)} | ${f2(Math.min(...p95s))}–${f2(Math.max(...p95s))} | ${f2(Math.max(...g.map((r) => r.p99)))} | ${f2(Math.max(...g.map((r) => r.max)))} | ${g.reduce((n, r) => n + r.snaps, 0)} | ${f2(Math.max(...g.map((r) => r.snapsPerMinute)))} | ${f2(Math.max(...g.map((r) => r.maxSnapMs)))} |`,
  );
}

lines.push(
  '',
  '### Plain interpolation: corrections per run (|delta| ≥ 5 / 20 / 30 / 40 ms; each is a visible jump under this policy)',
  '',
);
lines.push('| Run | ≥ 5 | ≥ 20 | ≥ 30 | ≥ 40 |', '|---|---|---|---|---|');
for (const r of rows.filter((x) => x.variant.startsWith('interpolation')))
  lines.push(
    `| ${r.run} | ${r.correctionsAt?.[5]} | ${r.correctionsAt?.[20]} | ${r.correctionsAt?.[30]} | ${r.correctionsAt?.[40]} |`,
  );

lines.push(
  '',
  '### Anchor availability and event checks (interpolation variant; identical for every variant)',
  '',
);
lines.push(
  '| Run | Seeks | Wait play → first anchor (ms) | Waits seek → anchor (ms) | Anchor gaps > 50 ms | Max gap | Duplicates rejected | Out of order |',
);
lines.push('|---|---|---|---|---|---|---|---|');
for (const r of rows.filter((x) => x.variant.startsWith('interpolation')))
  lines.push(
    `| ${r.run} | ${r.seeks} | ${r.startWaitMs ?? 'n/a'} | ${r.seekWaits.join(', ') || '—'} | ${r.anchorGapsOver50ms} | ${f2(r.maxAnchorGapMs)} | ${r.rejectedDuplicates} | ${r.rejectedOutOfOrder} |`,
  );

lines.push('', '### Exploratory slew rates (threshold 30 ms): tuning runs vs held-out runs', '');
lines.push(
  '| Variant | Browser | Interval | Split | Runs | p95 range | worst p99 | Snaps total |',
  '|---|---|---|---|---|---|---|---|',
);
const ex = new Map<string, Row[]>();
for (const r of rows.filter((x) => x.exploratory || x.variant === 'slew + snap ≥ 30 ms'))
  ex.set(`${r.variant}|${r.browser}|${r.interval}|${r.split}`, [
    ...(ex.get(`${r.variant}|${r.browser}|${r.interval}|${r.split}`) ?? []),
    r,
  ]);
for (const [key, g] of ex) {
  const [variant, browser, interval, split] = key.split('|');
  const p95s = g.map((r) => r.p95);
  lines.push(
    `| ${variant} | ${browser} | ${interval} | ${split} | ${g.length} | ${f2(Math.min(...p95s))}–${f2(Math.max(...p95s))} | ${f2(Math.max(...g.map((r) => r.p99)))} | ${g.reduce((n, r) => n + r.snaps, 0)} |`,
  );
}
writeFileSync(path.join(OUT, 'summary.md'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
