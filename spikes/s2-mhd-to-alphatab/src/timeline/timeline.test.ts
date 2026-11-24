// Spike S5 (ROADMAP S2-06): timeline parity between the independent MHD prototype and alphaTab's
// MidiFileGenerator on the Playback Score.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { validateDocument, type MhdDocument } from '@musichub/music-model';
import { describe, expect, it } from 'vitest';
import { allDocuments } from '../fixtures.ts';
import { newSettings } from '../run.ts';
import { toAlphaTabDirect } from '../strategy-a.ts';
import { compareEvents, type Category } from './compare.ts';
import { playbackOrder } from './playback-order.ts';
import { prototypeEvents, type TimelineEvent } from './prototype.ts';
import { referenceEvents } from './reference.ts';
import { scenarios } from './scenarios.ts';

function run(doc: MhdDocument) {
  const a = toAlphaTabDirect(doc, newSettings());
  const reference = referenceEvents(doc, a.channels, a.playbackScore, newSettings());
  const prototype = prototypeEvents(doc, a.channels);
  return { reference, prototype, comparison: compareEvents(reference, prototype.events) };
}

/** Bar order read from the reference MIDI of a scenario's main track (bar i plays pitch 60 + i). */
function referenceBarOrder(doc: MhdDocument, reference: TimelineEvent[]): number[] {
  return reference
    .filter((e) => e.type === 'noteOn' && e.trackId === doc.tracks[0]?.id)
    .sort((a, b) => a.tick - b.tick)
    .map((e) => (e.key ?? 0) - 60);
}

const nonExact = (counts: Record<Category, number>) =>
  Object.entries(counts).filter(([c, n]) => c !== 'exact' && n > 0);

describe('independence of the prototype', () => {
  it.each(['playback-order.ts', 'prototype.ts'])(
    '%s does not use alphaTab or its output',
    (file) => {
      const source = readFileSync(path.join(import.meta.dirname, file), 'utf8');
      const imports = [...source.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
      expect(imports.filter((i) => i?.includes('alphatab'))).toEqual([]);
      expect(imports.filter((i) => /reference|midi|strategy|scores|render/.test(i ?? ''))).toEqual(
        [],
      );
    },
  );
});

/** Scenarios expected to reach full parity, by name (every scenarios() call builds new objects). */
const PARITY = new Set(
  scenarios()
    .filter((s) => s.expectedOrder !== null && s.name !== 'repeat-end-after-repeat')
    .map((s) => s.name),
);

describe.each(scenarios())('scenario $name', (s) => {
  const { reference, prototype, comparison } = run(s.doc);

  it('is valid MHD v1', () => {
    expect(validateDocument(s.doc).valid).toBe(true);
  });

  it.skipIf(s.expectedOrder === null)(
    'the prototype plays the bars in the order MHD defines',
    () => {
      expect(playbackOrder(s.doc.masterBars).bars.map((b) => b.bar)).toEqual(s.expectedOrder);
    },
  );

  it('matches the golden reference MIDI (alphaTab 1.9.0)', () => {
    const golden = reference
      .map((e) =>
        e.type === 'tempo'
          ? `${e.tick} tempo ${e.bpm}`
          : `${e.tick} ${e.type} t${s.doc.tracks.findIndex((t) => t.id === e.trackId)} ch${e.channel} k${e.key} v${e.velocity}`,
      )
      .sort((a, b) => Number.parseFloat(a) - Number.parseFloat(b) || a.localeCompare(b));
    expect(golden).toMatchSnapshot();
  });

  it.runIf(PARITY.has(s.name))(
    'reaches 100 % event parity with alphaTab (note-on, note-off, tempo)',
    () => {
      // Scenarios with one note per bar: the reference MIDI shows the bar order directly.
      if (!['grace', 'ties', 'combined', 'fermata-ottava', 'sequential'].includes(s.name))
        expect(referenceBarOrder(s.doc, reference)).toEqual(s.expectedOrder);
      expect(nonExact(comparison.counts.noteOn)).toEqual([]);
      expect(nonExact(comparison.counts.noteOff)).toEqual([]);
      expect(nonExact(comparison.counts.tempo)).toEqual([]);
      expect(comparison.noteOnParity.exact).toBeGreaterThan(0);
      expect(prototype.unsupported).toEqual([]);
    },
  );
});

describe('documented divergences', () => {
  it('repeat end after a repeat: MHD repeats from the previous repeat end, alphaTab from the group opening', () => {
    const s = scenarios().find((x) => x.name === 'repeat-end-after-repeat');
    if (!s) throw new Error('scenario missing');
    const { reference, comparison } = run(s.doc);
    expect(playbackOrder(s.doc.masterBars).bars.map((b) => b.bar)).toEqual([
      0, 1, 2, 1, 2, 3, 4, 3, 4, 5,
    ]);
    expect(referenceBarOrder(s.doc, reference)).toEqual([0, 1, 2, 1, 2, 3, 4, 1, 2, 1, 2, 3, 4, 5]);
    expect(comparison.noteOnParity.exact).toBeLessThan(comparison.noteOnParity.comparable);
  });

  it('skipped closing bar: undefined in MHD; alphaTab repeats from it', () => {
    const s = scenarios().find((x) => x.name === 'ending-closing-skipped');
    if (!s) throw new Error('scenario missing');
    expect(s.expectedOrder).toBeNull();
    expect(referenceBarOrder(s.doc, run(s.doc).reference)).toEqual([0, 1, 2, 1, 1, 3, 4]);
  });
});

describe('S2 corpus (S2-05 documents)', () => {
  const docs = allDocuments(true);
  it.each(docs.map((d) => [d.name, d.doc] as const))(
    '%s: every note-on is exact or explained',
    (name, doc) => {
      const { comparison, prototype } = run(doc);
      const notes = new Map(
        doc.tracks.flatMap((t) =>
          t.staves.flatMap((s) =>
            s.bars.flatMap((b) =>
              b.voices.flatMap((v) =>
                v.beats.flatMap((bt) => bt.notes.map((n) => [n.id, n] as const)),
              ),
            ),
          ),
        ),
      );
      for (const f of comparison.findings.filter(
        (x) => x.type === 'noteOn' && x.category !== 'exact',
      )) {
        if (f.category === 'unsupported') continue; // constructs the prototype does not model (listed below)
        if (name === 'repeats') continue; // contains a skipped closing bar (undefined, see scenario ending-closing-skipped)
        // The only other allowed difference: alphaTab plays half-open hi-hats as GM 46.
        const note = f.prototype?.noteId ? notes.get(f.prototype.noteId) : undefined;
        expect([f.category, note?.drumTechnique, f.reference?.key]).toEqual([
          'pitch',
          'halfOpen',
          46,
        ]);
      }
      if (['guitar-basic', 'rhythm', 'effects'].includes(name))
        expect(prototype.unsupported.length).toBeGreaterThan(0);
      else expect(prototype.unsupported).toEqual([]);
    },
  );
});

describe('comparison categories', () => {
  const on = (tick: number, key: number, extra: Partial<TimelineEvent> = {}): TimelineEvent => ({
    type: 'noteOn',
    tick,
    trackId: 'T',
    channel: 0,
    key,
    velocity: 95,
    ...extra,
  });
  const categories = (ref: TimelineEvent[], proto: TimelineEvent[]) =>
    compareEvents(ref, proto)
      .findings.map((f) => f.category)
      .sort();

  it('classifies every kind of difference', () => {
    expect(categories([on(0, 60)], [on(0, 60)])).toEqual(['exact']);
    expect(categories([on(0, 60)], [on(0, 60, { velocity: 80 })])).toEqual(['velocity']);
    expect(categories([on(0, 60)], [on(0, 60, { channel: 1 })])).toEqual(['channel']);
    expect(categories([on(0, 60)], [on(0, 62)])).toEqual(['pitch']);
    expect(categories([on(0, 60)], [on(120, 60)])).toEqual(['timing']);
    expect(categories([on(0, 60), on(960, 62)], [on(0, 62), on(960, 60)])).toEqual([
      'ordering',
      'ordering',
    ]);
    expect(categories([on(0, 60)], [])).toEqual(['missing']);
    expect(categories([], [on(0, 60)])).toEqual(['extra']);
    expect(categories([on(0, 60)], [on(0, 61, { unsupported: 'trill' })])).toEqual(['unsupported']);
  });

  it('classifies an exactly matching event of an unmodelled construct as unsupported, not exact', () => {
    const result = compareEvents([on(0, 60)], [on(0, 60, { unsupported: 'brush' })]);
    expect(result.findings.map((f) => f.category)).toEqual(['unsupported']);
    expect(result.noteOnParity).toEqual({ exact: 0, comparable: 0 });
  });
});
