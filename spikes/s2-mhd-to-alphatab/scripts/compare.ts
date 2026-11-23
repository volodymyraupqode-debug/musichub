// Runs both strategies on every S2 document and prints the comparison (`pnpm compare`).
// Writes results/compare.json and results/<name>.atex (generated alphaTex) for inspection.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { validateDocument } from '@musichub/music-model';
import { allDocuments } from '../src/fixtures.ts';
import { recoverIdMap } from '../src/id-map.ts';
import { summarizeLosses } from '../src/losses.ts';
import { midiDiff, midiSummary } from '../src/midi.ts';
import { renderScore } from '../src/render.ts';
import { compare, newSettings } from '../src/run.ts';

const out = path.resolve(import.meta.dirname, '../results');
mkdirSync(out, { recursive: true });
const report: unknown[] = [];
console.log(
  '| Document | Valid | A | B | A = B facts | A vs MHD | B vs MHD | MIDI notes (A = B) | Strict MIDI diff | Rendered bars/beats/notes | ids (A / B recovered) |',
);
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const { name, kind, doc } of allDocuments(true)) {
  const valid = validateDocument(doc).valid;
  const c = compare(doc);
  const a = c.a.result;
  const b = c.b.result;
  if (!a || !b) {
    console.log(
      `| ${name} | ${valid} | ${c.a.error ?? 'ok'} | ${c.b.error ?? 'ok'} | – | – | – | – | – | – | – |`,
    );
    continue;
  }
  const ma = midiSummary(a.score, newSettings());
  const mb = midiSummary(b.score, newSettings());
  const notesEqual = midiDiff(ma, mb, true).length === 0;
  const strict = midiDiff(ma, mb).length;
  const render = kind === 'performance' ? undefined : renderScore(a.score, newSettings());
  const recovered = recoverIdMap(doc, b.score as never);
  writeFileSync(path.join(out, `${name}.atex`), b.tex);
  const groups = (d: { group: string }[]) => (d.length ? d.map((x) => x.group).join(', ') : 'none');
  console.log(
    `| ${name} | ${valid} | ok | ok | ${c.aVsB.length === 0 ? 'yes' : groups(c.aVsB)} | ${groups(c.a.vsMhd)} | ${groups(c.b.vsMhd)} | ${ma.noteOns} (${notesEqual ? 'yes' : 'no'}) | ${strict} | ${render ? `${render.bars}/${render.beats}/${render.notes}` : 'skipped'} | ${a.idMap.byId.size} / ${recovered.idMap.byId.size} (${recovered.unmatched.length} unmatched) |`,
  );
  report.push({
    name,
    kind,
    valid,
    aVsB: c.aVsB,
    aVsMhd: c.a.vsMhd,
    bVsMhd: c.b.vsMhd,
    midi: {
      noteOnsA: ma.noteOns,
      noteOnsB: mb.noteOns,
      notesEqual,
      strictDiff: midiDiff(ma, mb).slice(0, 20),
      sustainEventsA: ma.sustainEvents,
    },
    losses: {
      a: Object.fromEntries(summarizeLosses(a.losses)),
      b: Object.fromEntries(summarizeLosses(b.losses)),
    },
    texBytes: b.tex.length,
  });
}
writeFileSync(path.join(out, 'compare.json'), JSON.stringify(report, null, 2));
console.log(`\nWritten ${path.relative(process.cwd(), out)}/compare.json and *.atex`);
