// Spike S3 (ROADMAP S2-10): summarises the raw edit-loop runs in data/edit-loop/ (warm-up edits
// excluded) into data/edit-loop/summary.json and Markdown tables on stdout. Usage:
// `pnpm edit-loop-analyze`.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { summarize, type LatencySummary } from '../src/edit-loop/stats.ts';

const DIR = path.join(import.meta.dirname, '../data/edit-loop');
const STAGES = [
  'edit',
  'convert',
  'renderCall',
  'renderFinished',
  'hitTest',
  'frame',
  'editedBarDrawn',
  'midiLoaded',
] as const;
type Rec = Record<string, unknown> & { warmup?: boolean };
interface Run {
  scenario: { doc: string; variant: string; playing?: boolean; caret?: string };
  project: string;
  meta: Record<string, unknown>;
  errors: string[];
  pageErrors: string[];
  records: Rec[];
}

const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.json.gz'))
  .sort();
const out: Record<string, unknown>[] = [];
const fmt = (s: LatencySummary | null) =>
  s ? `${s.median.toFixed(1)} / ${s.p95.toFixed(1)} / ${s.max.toFixed(1)} / ${s.over}` : 'n/a';
const rows: string[] = [];
const playing: string[] = [];
for (const f of files) {
  const run = JSON.parse(gunzipSync(readFileSync(path.join(DIR, f))).toString('utf8')) as Run;
  const records = run.records.filter((r) => !r.warmup);
  if (run.scenario.playing) {
    const deltas = records.map((r) =>
      Math.abs((r.tickAfterRestore as number) - (r.tickBefore as number)),
    );
    const midi = records.map((r) => r.midiLoaded as number);
    const stopped = records.filter((r) => r.stateAfterLoad === 0).length;
    out.push({
      file: f,
      project: run.project,
      scenario: run.scenario,
      n: records.length,
      stopped,
      maxTickDelta: Math.max(...deltas),
      midiLoaded: summarize(midi),
    });
    playing.push(
      `| ${run.project} | ${records.length} | ${stopped}/${records.length} | ${Math.max(...deltas)} | ${fmt(summarize(midi))} |`,
    );
    continue;
  }
  const stages: Record<string, LatencySummary | null> = {};
  for (const s of STAGES) {
    const values = records.map((r) => r[s]).filter((v): v is number => typeof v === 'number');
    stages[s] =
      values.length === records.length
        ? summarize(values)
        : values.length > 0
          ? summarize(values)
          : null;
  }
  const missingDrawn = records.filter((r) => r.editedBarDrawn === null).length;
  out.push({
    file: f,
    project: run.project,
    scenario: run.scenario,
    n: records.length,
    meta: run.meta,
    errors: run.errors,
    pageErrors: run.pageErrors,
    missingDrawn,
    stages,
  });
  rows.push(
    `| ${run.project} | ${run.scenario.doc} | ${run.scenario.variant} | ${run.scenario.caret === 'first' ? '0–1' : '2–9'} | ${records.length} | ${fmt(stages.convert ?? null)} | ${fmt(stages.renderCall ?? null)} | ${fmt(stages.renderFinished ?? null)} | ${fmt(stages.frame ?? null)} | ${fmt(stages.editedBarDrawn ?? null)}${missingDrawn ? ` (${missingDrawn} not seen)` : ''} | ${fmt(stages.midiLoaded ?? null)} |`,
  );
}
writeFileSync(path.join(DIR, 'summary.json'), JSON.stringify(out, null, 2) + '\n');
console.log(
  'Values in ms: median / p95 / max / count > 150 ms. Times from t0 (edit start) unless noted.',
);
console.log('');
console.log(
  '| Browser | Document | Variant | Edited bars | n | Convert (stage) | renderScore call (stage) | t0 → renderFinished | t0 → next frame | t0 → edited bar drawn | t0 → midiLoaded |',
);
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(r);
console.log('');
console.log(
  '| Browser | Edits while playing | Playback stopped by the edit | Max abs(tick restored − tick stored) | t0 → midiLoaded |',
);
console.log('|---|---|---|---|---|');
for (const r of playing) console.log(r);
