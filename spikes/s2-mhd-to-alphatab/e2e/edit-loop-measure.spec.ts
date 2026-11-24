// Spike S3 (ROADMAP S2-10) measurement runs. Skipped unless S3_MEASURE=1:
//   S3_MEASURE=1 pnpm exec playwright test e2e/edit-loop-measure.spec.ts --workers=1
// Every scenario: 3 warm-up edits (recorded, flagged) + 30 measured edits, one browser page each,
// runs serial. Raw records and metadata go to data/edit-loop/<project>-<scenario>.json.gz.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { test } from '@playwright/test';
import { openHarness } from './edit-loop-page.ts';
import { startEditLoopServer, type EditLoopServer } from './edit-loop-server.ts';

const WARMUP = 3;
const EDITS = 30;
const PLAYING_EDITS = 10;
const SCENARIOS = [
  { doc: 'small', variant: 'baseline' },
  { doc: 'medium', variant: 'baseline' },
  { doc: 'large', variant: 'baseline' },
  { doc: 'large', variant: 'track' },
  { doc: 'large', variant: 'horizontal' },
  { doc: 'large', variant: 'window' },
  // Added after the first run: edits in bars 0–1 so the edited bar is inside the viewport (§ report).
  { doc: 'medium', variant: 'baseline', caret: 'first' },
  { doc: 'large', variant: 'baseline', caret: 'first' },
  { doc: 'large', variant: 'window', caret: 'first' },
  // Decoupled MIDI (renderer only, no MIDI regeneration on edit): a measured fallback candidate.
  { doc: 'medium', variant: 'nomidi', caret: 'first' },
  { doc: 'large', variant: 'nomidi', caret: 'first' },
  // Both: render window around the caret and decoupled MIDI.
  { doc: 'large', variant: 'window-nomidi', caret: 'first' },
] as const satisfies readonly { doc: string; variant: string; caret?: 'first' }[];
const OUT = path.join(import.meta.dirname, '../data/edit-loop');

test.skip(process.env.S3_MEASURE !== '1', 'measurement runs only with S3_MEASURE=1');
test.describe.configure({ mode: 'serial' });

let server: EditLoopServer;
test.beforeAll(async () => {
  server = await startEditLoopServer();
});
test.afterAll(async () => {
  await server.close();
});

function save(project: string, name: string, data: unknown) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, `${project}-${name}.json.gz`), gzipSync(JSON.stringify(data)));
}

for (const s of SCENARIOS) {
  const caret = 'caret' in s ? s.caret : undefined;
  const name = `${s.doc}-${s.variant}${caret ? '-caret0' : ''}`;
  test(`edit loop ${name}`, async ({ page, browserName }, info) => {
    test.setTimeout(900_000);
    const pageErrors = await openHarness(page, server.origin, s.doc, s.variant, caret);
    const records: unknown[] = [];
    for (let i = 0; i < WARMUP + EDITS; i++) {
      const r = await page.evaluate<Record<string, unknown>>(`window.__s3.edit(${i})`);
      records.push({ ...r, warmup: i < WARMUP });
      await page.waitForTimeout(200);
    }
    save(info.project.name, name, {
      scenario: s,
      warmup: WARMUP,
      edits: EDITS,
      browser: browserName,
      project: info.project.name,
      headless: true,
      recordedAt: new Date().toISOString(),
      host: { platform: process.platform, arch: process.arch, node: process.version },
      meta: await page.evaluate('window.__s3.meta()'),
      errors: await page.evaluate('window.__s3.errors'),
      pageErrors,
      records,
    });
  });
}

test('edit while playing: tick position stored and restored (medium)', async ({
  page,
  browserName,
}, info) => {
  test.setTimeout(600_000);
  const pageErrors = await openHarness(page, server.origin, 'medium');
  await page.waitForFunction('window.__s3.ready()', undefined, { timeout: 60_000 });
  const records: unknown[] = [];
  for (let i = 0; i < PLAYING_EDITS; i++) {
    await page.click('#play'); // user gesture; playback stops on every edit (S7)
    await page.waitForFunction('window.__s3.state() === 1', undefined, { timeout: 30_000 });
    await page.waitForTimeout(1000);
    records.push(await page.evaluate(`window.__s3.editWhilePlaying(${i})`));
    await page.waitForTimeout(300);
  }
  save(info.project.name, 'medium-playing', {
    scenario: { doc: 'medium', variant: 'baseline', playing: true },
    edits: PLAYING_EDITS,
    browser: browserName,
    project: info.project.name,
    headless: true,
    recordedAt: new Date().toISOString(),
    host: { platform: process.platform, arch: process.arch, node: process.version },
    meta: await page.evaluate('window.__s3.meta()'),
    errors: await page.evaluate('window.__s3.errors'),
    pageErrors,
    records,
  });
});
