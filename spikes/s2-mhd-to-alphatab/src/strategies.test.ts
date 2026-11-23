import * as alphaTab from '@coderline/alphatab';
import { validateDocument } from '@musichub/music-model';
import { describe, expect, it } from 'vitest';
import { allDocuments } from './fixtures.ts';
import { midiDiff, midiSummary } from './midi.ts';
import { renderScore } from './render.ts';
import { compare, newSettings } from './run.ts';

/**
 * Fact groups where alphaTab itself deviates from MHD semantics, identically for both strategies
 * (each is pinned down in findings.test.ts). Everything else must match MHD exactly.
 */
const KNOWN_DEVIATIONS: Record<string, string[]> = {
  'guitar-basic': ['rhythm'], // grace beat value normalised, before-beat grace shortens the previous beat
  'ties-grace': ['rhythm'],
  rhythm: ['rhythm'], // 7:8 tuplet ticks truncated to integers
  'band-repeats': ['percussion'], // halfOpen sounds as GM 46
  percussion: ['percussion'], // + no rimshot for GM 40
  'performance-300x8': ['percussion'],
};

const docs = allDocuments(true);

describe.each(docs)('$name', ({ name, doc }) => {
  const comparison = compare(doc);

  it('is valid MHD v1', () => {
    expect(validateDocument(doc).valid).toBe(true);
  });

  it('builds an alphaTab Score with both strategies', () => {
    expect(comparison.a.error).toBeUndefined();
    expect(comparison.b.error).toBeUndefined();
  });

  it('A and B produce the same alphaTab facts', () => {
    expect(comparison.aVsB).toEqual([]);
  });

  it('matches MHD semantics except for documented alphaTab deviations', () => {
    const allowed = KNOWN_DEVIATIONS[name] ?? [];
    expect(comparison.a.vsMhd.map((d) => d.group).filter((g) => !allowed.includes(g))).toEqual([]);
    expect(comparison.b.vsMhd.map((d) => d.group).filter((g) => !allowed.includes(g))).toEqual([]);
  });

  it('generates the same MIDI note and tempo events (channels aside)', () => {
    const a = comparison.a.result;
    const b = comparison.b.result;
    if (!a || !b) throw new Error('strategy failed');
    const ma = midiSummary(a.score, newSettings());
    const mb = midiSummary(b.score, newSettings());
    expect(ma.noteOns).toBeGreaterThan(0);
    expect(midiDiff(ma, mb, true)).toEqual([]);
  });

  it('exports to Guitar Pro 7 and re-imports with the same MIDI notes (both strategies)', () => {
    for (const result of [comparison.a.result, comparison.b.result]) {
      if (!result) throw new Error('strategy failed');
      const bytes = new alphaTab.exporter.Gp7Exporter().export(result.score, newSettings());
      const reimported = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, newSettings());
      const notes = (m: ReturnType<typeof midiSummary>) =>
        m.events.filter((e) => e.startsWith('on '));
      const before = midiSummary(result.score, newSettings());
      const after = midiSummary(reimported, newSettings());
      const diff = midiDiff(
        { ...before, events: notes(before) },
        { ...after, events: notes(after) },
        true,
      );
      // `effects`: the GP7 round trip changes the trill playback (alphaTab 1.9, same for A and B).
      if (name === 'effects') expect(diff.length).toBe(4);
      else expect(diff).toEqual([]);
    }
  });

  it.skipIf(name === 'performance-300x8')(
    'renders every bar, beat and note with both strategies',
    () => {
      let beats = 0;
      let notes = 0;
      let bars = 0;
      for (const t of doc.tracks)
        for (const s of t.staves)
          for (const b of s.bars) {
            // One BarBounds per drawn notation (standard, tab, slash, numbered) of the staff.
            bars += Math.max(1, Object.values(s.display).filter(Boolean).length);
            for (const v of b.voices) {
              beats += v.beats.length;
              for (const bt of v.beats) notes += bt.notes.length;
            }
          }
      for (const result of [comparison.a.result, comparison.b.result]) {
        if (!result) throw new Error('strategy failed');
        const r = renderScore(result.score, newSettings());
        expect(r.error).toBeUndefined();
        expect(r.masterBars).toBe(doc.masterBars.length);
        expect(r.bars).toBe(bars);
        expect(r.beats).toBe(beats);
        expect(r.notes).toBe(notes);
      }
    },
  );
});
