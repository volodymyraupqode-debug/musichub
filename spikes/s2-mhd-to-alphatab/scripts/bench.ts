// Benchmark of both strategies on the 300 × 8 document (`pnpm bench`, run with --expose-gc).
// Conversion only: Strategy A = build + finish(); Strategy B = alphaTex generation + parse
// (ScoreLoader.loadAlphaTex, which includes finish()). Rendering is measured separately.
import type * as alphaTab from '@coderline/alphatab';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { performanceDocument } from '../src/performance.ts';
import { recoverIdMap } from '../src/id-map.ts';
import { renderScore } from '../src/render.ts';
import { newSettings } from '../src/run.ts';
import { toAlphaTabDirect } from '../src/strategy-a.ts';
import { toAlphaTabViaTex } from '../src/strategy-b.ts';

const WARM_RUNS = Number(process.env.BENCH_RUNS ?? 30);
const RENDER_RUNS = Number(process.env.BENCH_RENDER_RUNS ?? 5);
const gc = (globalThis as { gc?: () => void }).gc;

function stats(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)] ?? NaN;
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return {
    n: s.length,
    mean: +mean.toFixed(2),
    median: +at(0.5).toFixed(2),
    p95: +at(0.95).toFixed(2),
    min: +(s[0] ?? NaN).toFixed(2),
    max: +(s.at(-1) ?? NaN).toFixed(2),
  };
}

function heapDelta(run: () => unknown): number {
  if (!gc) return NaN;
  gc();
  const before = process.memoryUsage().heapUsed;
  const keep = run();
  gc();
  const after = process.memoryUsage().heapUsed;
  void keep;
  return (after - before) / 1024 / 1024;
}

function countObjects(score: alphaTab.model.Score) {
  let bars = 0,
    voices = 0,
    beats = 0,
    notes = 0;
  for (const t of score.tracks)
    for (const s of t.staves)
      for (const b of s.bars) {
        bars++;
        for (const v of b.voices) {
          voices++;
          for (const bt of v.beats) {
            beats++;
            notes += bt.notes.length;
          }
        }
      }
  return {
    masterBars: score.masterBars.length,
    tracks: score.tracks.length,
    staves: score.tracks.reduce((n, t) => n + t.staves.length, 0),
    bars,
    voices,
    beats,
    notes,
  };
}

const require = createRequire(import.meta.url);
// package.json is not in alphaTab's exports map: read it next to the resolved entry point.
const alphaTabVersion = (
  JSON.parse(
    readFileSync(
      path.join(path.dirname(require.resolve('@coderline/alphatab')), '../package.json'),
      'utf8',
    ),
  ) as { version: string }
).version;
const doc = performanceDocument();
console.log(
  `Environment: Node ${process.version}, ${os.cpus()[0]?.model ?? 'unknown CPU'} (${os.cpus().length} threads), ${os.platform()} ${os.release()}, alphaTab ${alphaTabVersion}, gc ${gc ? 'exposed' : 'not exposed'}`,
);

type Sample = Record<string, number>;
const samples: { a: Sample[]; b: Sample[] } = { a: [], b: [] };
// Alternate A and B so that JIT warm-up and thermal effects hit both equally; run 0 = cold.
for (let i = 0; i <= WARM_RUNS; i++) {
  const a = toAlphaTabDirect(doc, newSettings());
  samples.a.push({
    build: a.timings.build,
    finish: a.timings.finish,
    total: a.timings.build + a.timings.finish,
  });
  const b = toAlphaTabViaTex(doc, newSettings());
  const t0 = performance.now();
  recoverIdMap(doc, b.renderScore as never);
  const idMap = performance.now() - t0;
  samples.b.push({
    generate: b.timings.generate,
    parse: b.timings.parse,
    total: b.timings.generate + b.timings.parse,
    idMap,
    totalWithIdMap: b.timings.generate + b.timings.parse + idMap,
  });
}

const report = (label: string, rows: Sample[]) => {
  const [cold, ...warm] = rows;
  console.log(
    `\n${label}: cold run`,
    JSON.stringify(
      Object.fromEntries(Object.entries(cold ?? {}).map(([k, v]) => [k, +v.toFixed(2)])),
    ),
  );
  for (const key of Object.keys(warm[0] ?? {}))
    console.log(`  warm ${key.padEnd(15)}`, JSON.stringify(stats(warm.map((r) => r[key] ?? NaN))));
};
report('Strategy A (build + finish)', samples.a);
report('Strategy B (generate + parse; idMap = positional recovery)', samples.b);

const a = toAlphaTabDirect(doc, newSettings());
const b = toAlphaTabViaTex(doc, newSettings());
console.log(
  '\nalphaTex size:',
  b.tex.length,
  'characters,',
  Buffer.byteLength(b.tex),
  'bytes; MHD JSON:',
  Buffer.byteLength(JSON.stringify(doc)),
  'bytes',
);
console.log(
  'alphaTab objects (A):',
  JSON.stringify(countObjects(a.renderScore)),
  ' (B):',
  JSON.stringify(countObjects(b.renderScore)),
);
console.log(
  'Retained heap after conversion (MB, gc before/after, single run): A',
  heapDelta(() => toAlphaTabDirect(doc, newSettings()).renderScore).toFixed(1),
  ' B',
  heapDelta(() => toAlphaTabViaTex(doc, newSettings()).renderScore).toFixed(1),
);

const renders: number[] = [];
for (let i = 0; i < RENDER_RUNS; i++)
  renders.push(renderScore(toAlphaTabDirect(doc, newSettings()).renderScore, newSettings()).ms);
console.log(
  `\nRendering (separate from conversion; Node SVG, all 8 tracks, width 1300, run 0 cold):`,
  JSON.stringify({ cold: +(renders[0] ?? NaN).toFixed(1), warm: stats(renders.slice(1)) }),
);
