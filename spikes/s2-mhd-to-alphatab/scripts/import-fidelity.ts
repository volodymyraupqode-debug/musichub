// Spike S4 (ROADMAP S2-09): prints the import-fidelity coverage matrix of the fixtures in
// fixtures/import as Markdown (docs/spikes/s4-import-fidelity.md §6). Usage: `pnpm import-fidelity`.
import * as alphaTab from '@coderline/alphatab';
import { validateDocument } from '@musichub/music-model';
import {
  GROUPS,
  compareDocuments,
  compareScores,
  compareWithIntent,
  importFixture,
  type GroupResult,
} from '../src/import/evaluate.ts';
import { fromAlphaTab } from '../src/import/from-alphatab.ts';
import { fixtureFile, intents } from '../src/import/intent.ts';
import { newSettings } from '../src/run.ts';
import { toAlphaTabDirect } from '../src/strategy-a.ts';

const mark = (r: GroupResult | undefined) =>
  !r || r.status === 'not exercised'
    ? '—'
    : r.status === 'not evaluated'
      ? 'n/e'
      : r.status === 'supported'
        ? '✅'
        : r.status === 'partial'
          ? `🟡 ${r.matched}/${r.expected}`
          : `❌ ${r.matched}/${r.expected}`;
const groups = [...GROUPS, 'dynamics', 'noteEffects', 'lyrics'];
const rows: string[] = [];
for (const intent of intents()) {
  const imported = importFixture(fixtureFile(intent));
  const { doc, losses } = fromAlphaTab(imported, intent.doc.id);
  const back = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
    new alphaTab.exporter.Gp7Exporter().export(
      toAlphaTabDirect(doc, newSettings()).renderScore,
      newSettings(),
    ),
    newSettings(),
  );
  const stages = {
    import: compareWithIntent(intent.doc, imported, intent.notEvaluated),
    mhd: compareDocuments(intent.doc, doc, intent.notEvaluated),
    gp7: compareScores(imported, back),
  };
  for (const [stage, results] of Object.entries(stages)) {
    const by = new Map(results.map((r) => [r.group, r]));
    rows.push(`| ${intent.name} | ${stage} | ${groups.map((g) => mark(by.get(g))).join(' | ')} |`);
  }
  console.error(
    `${intent.name}: MHD valid ${validateDocument(doc).valid}; losses ${[...new Set(losses.map((l) => l.feature))].join(', ')}`,
  );
}
console.log(`| Fixture | Stage | ${groups.join(' | ')} |`);
console.log(`|---|---|${groups.map(() => '---').join('|')}|`);
for (const r of rows) console.log(r);
