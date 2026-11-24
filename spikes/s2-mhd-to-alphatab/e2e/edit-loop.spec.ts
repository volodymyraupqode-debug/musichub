// Spike S3 (ROADMAP S2-10) smoke test: the edit-loop harness converts, re-renders and reports every
// stage for each document. Not a measurement (see edit-loop-measure.spec.ts).
import { expect, test } from '@playwright/test';
import { openHarness } from './edit-loop-page.ts';
import { startEditLoopServer, type EditLoopServer } from './edit-loop-server.ts';

let server: EditLoopServer;
test.beforeAll(async () => {
  server = await startEditLoopServer();
});
test.afterAll(async () => {
  await server.close();
});

interface EditRecord {
  edit: number;
  convert: number;
  renderCall: number;
  renderFinished: number;
  frame: number;
  editedBarDrawn: number | null;
  midiLoaded: number | null;
  beatsInBounds: number;
}

for (const doc of ['small', 'medium', 'large']) {
  test(`edit loop reports every stage (${doc})`, async ({ page }) => {
    test.setTimeout(180_000);
    const pageErrors = await openHarness(page, server.origin, doc);
    for (let i = 0; i < 3; i++) {
      const r = await page.evaluate<EditRecord>(`window.__s3.edit(${i})`);
      for (const k of ['edit', 'convert', 'renderCall', 'renderFinished', 'frame'] as const)
        expect(r[k]).toBeGreaterThanOrEqual(0);
      expect(r.frame).toBeGreaterThanOrEqual(r.renderFinished);
      expect(r.midiLoaded).not.toBeNull();
      expect(r.beatsInBounds).toBeGreaterThan(0);
    }
    expect(await page.evaluate<string[]>('window.__s3.errors')).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}
