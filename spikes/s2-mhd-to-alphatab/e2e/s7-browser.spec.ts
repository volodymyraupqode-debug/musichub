// Spike S7 (ROADMAP S2-07), browser criteria B1–B4 (docs/spikes/s7-playback-score-variants.md
// §5): the real AlphaTabApi renders a Render Score while the hook makes the player play the
// Playback Score. e2e/s7-server.ts serves the harness. Plain HTML, no Next.js: React and
// Turbopack integration is covered by spike S1, not here.
import * as alphaTab from '@coderline/alphatab';
import { expect, test, type Page } from '@playwright/test';
import { rewriteMidiFile } from '../src/playback-variants/hook.ts';
import { variantPairs, type VariantPair } from '../src/playback-variants/pairs.ts';
import { newSettings } from '../src/run.ts';
import { startS7Server, type S7Server } from './s7-server.ts';

const pairs = new Map(variantPairs().map((p) => [p.name, p]));
const pair = (name: VariantPair['name']): VariantPair => {
  const p = pairs.get(name);
  if (!p) throw new Error(`pair ${name} missing`);
  return p;
};

/** `channel:key` of every note-on the player should receive (the rewritten MIDI, Node). */
function expectedNotes(p: VariantPair): string[] {
  const settings = newSettings();
  const file = new alphaTab.midi.MidiFile();
  const generator = new alphaTab.midi.MidiFileGenerator(
    p.render,
    settings,
    new alphaTab.midi.AlphaSynthMidiFileHandler(file),
  );
  generator.applyTranspositionPitches = false;
  generator.generate();
  rewriteMidiFile(file, p.playback, settings);
  return [
    ...new Set(
      file.events
        .filter((e) => e instanceof alphaTab.midi.NoteOnEvent)
        .map((e) => `${e.channel}:${e.noteKey}`),
    ),
  ].sort();
}

function excludedKeys(p: VariantPair): number[] {
  const t = p.doc.tracks.filter((x) => p.excluded.includes(x.id));
  return t.flatMap((x) =>
    x.staves.flatMap((s) =>
      s.bars.flatMap((b) =>
        b.voices.flatMap((v) => v.beats.flatMap((bt) => bt.notes.map((n) => n.pitch ?? -1))),
      ),
    ),
  );
}

let server: S7Server;
let origin = '';

test.beforeAll(async () => {
  server = await startS7Server();
  origin = server.origin;
});

test.afterAll(async () => {
  await server.close();
});

interface Log {
  notes: { channel: number; key: number; score: string }[];
  beats: { owner: string; bar: number }[];
  midiLoads: number;
  midiLoaded: number;
  renderFinished: number;
  playerReady: number;
  finished: number;
  states: { state: number; stopped: boolean; score: string }[];
  errors: string[];
}
interface Stats {
  midiLoads: number;
  rewritten: number;
  failures: string[];
  lastTickShift?: number;
}

const log = (page: Page) => page.evaluate<Log>('structuredClone(window.__s7.log)');
const stats = (page: Page) => page.evaluate<Stats>('structuredClone(window.__s7.hook.stats)');
const notes = (l: Log) => [...new Set(l.notes.map((n) => `${n.channel}:${n.key}`))].sort();

test('S7: the player plays the Playback Score while the Render Score is rendered', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${origin}/`);
  await expect
    .poll(async () => (await log(page)).renderFinished, { timeout: 30_000 })
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await log(page)).playerReady, { timeout: 30_000 })
    .toBeGreaterThan(0);

  await test.step('B1: every midiLoad is rewritten; the API keeps the Render Score', async () => {
    const s = await stats(page);
    expect(s.midiLoads).toBeGreaterThan(0);
    expect(s.rewritten).toBe(s.midiLoads);
    expect(s.failures).toEqual([]);
    expect(await page.evaluate<string>('window.__s7.nameOfScore()')).toBe('E3');
    expect(await page.evaluate<number>('window.__s7.api.tracks.length')).toBe(3);
    testInfo.annotations.push({
      type: 'B1 midiLoads after first render',
      description: String(s.midiLoads),
    });
  });

  const playToEnd = async () => {
    const before = (await log(page)).finished;
    await page.evaluate('window.__s7.clearLog()');
    await page.click('#play'); // a user gesture, required for the AudioContext in some engines
    await expect
      .poll(async () => (await log(page)).finished, { timeout: 30_000 })
      .toBeGreaterThan(before);
    return log(page);
  };

  await test.step('B2: played note-ons are the Playback Score only; beats are Render Score beats', async () => {
    const l = await playToEnd();
    expect(notes(l)).toEqual(expectedNotes(pair('E3')));
    expect(l.notes.filter((n) => excludedKeys(pair('E3')).includes(n.key))).toEqual([]);
    expect(l.beats.length).toBeGreaterThan(0);
    expect(l.beats.every((b) => b.owner === 'E3')).toBe(true);
  });

  await test.step('B3: rendering a track subset of the same Score does not reload the MIDI', async () => {
    const loads = (await stats(page)).midiLoads;
    const rendered = (await log(page)).renderFinished;
    await page.evaluate("window.__s7.render('E3', [0, 2])");
    await expect.poll(async () => (await log(page)).renderFinished).toBeGreaterThan(rendered);
    expect((await stats(page)).midiLoads).toBe(loads);
    expect(await page.evaluate<number>('window.__s7.api.tracks.length')).toBe(2);
    const l = await playToEnd();
    expect(notes(l)).toEqual(expectedNotes(pair('E3')));
  });

  await test.step('B4: replacing the Render Score during playback reloads and rewrites the MIDI', async () => {
    await page.evaluate("window.__s7.render('E3')");
    await page.evaluate('window.__s7.clearLog()');
    await page.click('#play');
    await expect
      .poll(async () => (await log(page)).notes.length, { timeout: 30_000 })
      .toBeGreaterThan(1);
    const loads = (await stats(page)).midiLoads;
    const rendered = (await log(page)).renderFinished;
    await page.evaluate("window.__s7.render('E16')");
    const s = await stats(page);
    expect(s.midiLoads).toBe(loads + 1); // loadMidiForScore runs synchronously in renderScore
    expect(s.rewritten).toBe(s.midiLoads);
    expect(await page.evaluate<string>('window.__s7.nameOfScore()')).toBe('E16');
    await expect
      .poll(async () => (await log(page)).renderFinished, { timeout: 30_000 })
      .toBeGreaterThan(rendered);
    const state = await page.evaluate<number>('window.__s7.api.playerState');
    testInfo.annotations.push({
      type: 'B4 player state after replacement (0 paused, 1 playing)',
      description: String(state),
    });
    if (state === 1) await page.click('#play'); // pause, then play from a known state
    await page.evaluate('window.__s7.stop()');
    const l = await playToEnd();
    expect(notes(l)).toEqual(expectedNotes(pair('E16')));
    expect(l.notes.filter((n) => excludedKeys(pair('E16')).includes(n.key))).toEqual([]);
    expect(l.beats.every((b) => b.owner === 'E16')).toBe(true);
  });

  const final = await log(page);
  testInfo.annotations.push({ type: 'player states', description: JSON.stringify(final.states) });
  expect(final.errors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('control: without the hook alphaTab plays the excluded track on its placeholder channel', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto(`${origin}/?hook=off`);
  await expect
    .poll(async () => (await log(page)).playerReady, { timeout: 30_000 })
    .toBeGreaterThan(0);
  const before = (await log(page)).finished;
  await page.click('#play');
  await expect
    .poll(async () => (await log(page)).finished, { timeout: 30_000 })
    .toBeGreaterThan(before);
  const l = await log(page);
  const excluded = excludedKeys(pair('E3'));
  const played = l.notes.filter((n) => excluded.includes(n.key));
  expect(played.length).toBeGreaterThan(0);
  expect([...new Set(played.map((n) => n.channel))]).toEqual([0]);
  expect(notes(l)).not.toEqual(expectedNotes(pair('E3')));
});
