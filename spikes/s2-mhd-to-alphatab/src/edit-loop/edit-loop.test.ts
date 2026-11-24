// Spike S3 (ROADMAP S2-10): tests of the modelled edit command and the latency statistics.
import { validateDocument } from '@musichub/music-model';
import { describe, expect, it } from 'vitest';
import { canonical } from '../fixtures.ts';
import { performanceDocument } from '../performance.ts';
import { editNote, notesOf } from './edit.ts';
import { percentile, summarize } from './stats.ts';

describe('editNote (model of a single-note editor-core command)', () => {
  const doc = performanceDocument(20);
  const refs = notesOf(doc, 0).filter((n) => n.bar >= 2 && n.bar <= 9);

  it('changes exactly one note and keeps the document valid', () => {
    const ref = refs[0];
    if (!ref) throw new Error('no note');
    const next = editNote(doc, ref, 1);
    expect(validateDocument(next).valid).toBe(true);
    const before =
      doc.tracks[0]?.staves[ref.staff]?.bars[ref.bar]?.voices[ref.voice]?.beats[ref.beat]?.notes[
        ref.note
      ];
    const after =
      next.tracks[0]?.staves[ref.staff]?.bars[ref.bar]?.voices[ref.voice]?.beats[ref.beat]?.notes[
        ref.note
      ];
    expect(after?.id).toBe(before?.id);
    expect(after?.fret).toBe((before?.fret ?? 0) + 1);
    expect(JSON.stringify({ ...after, fret: before?.fret })).toBe(JSON.stringify(before));
  });

  it('shares every unchanged object with the previous document (structural sharing)', () => {
    const ref = refs[0];
    if (!ref) throw new Error('no note');
    const next = editNote(doc, ref, 1);
    expect(next === doc).toBe(false);
    expect(next.masterBars === doc.masterBars).toBe(true);
    expect(next.tracks[1] === doc.tracks[1]).toBe(true);
    const staffBefore = doc.tracks[0]?.staves[ref.staff];
    const staffAfter = next.tracks[0]?.staves[ref.staff];
    expect(staffAfter?.bars[ref.bar + 1] === staffBefore?.bars[ref.bar + 1]).toBe(true);
    expect(staffAfter?.bars[ref.bar] === staffBefore?.bars[ref.bar]).toBe(false);
  });

  it('keeps frets and pitches in range', () => {
    const piano = canonical('piano-grand-staff');
    const ref = notesOf(piano, 0)[0];
    if (!ref) throw new Error('no note');
    const up = editNote(piano, ref, 1);
    const n =
      up.tracks[0]?.staves[ref.staff]?.bars[ref.bar]?.voices[ref.voice]?.beats[ref.beat]?.notes[
        ref.note
      ];
    expect(n?.pitch).toBeDefined();
    expect(validateDocument(up).valid).toBe(true);
    expect(() => editNote(piano, { ...ref, id: 'S9xxxxxxxxxx' }, 1)).toThrow();
  });
});

describe('latency statistics', () => {
  it('uses nearest-rank percentiles and counts values over the budget', () => {
    const v = Array.from({ length: 100 }, (_, i) => i + 101); // 101…200
    expect(percentile(v, 0.5)).toBe(150);
    expect(summarize(v)).toEqual({
      n: 100,
      median: 150,
      p95: 195,
      max: 200,
      min: 101,
      over: 50,
      budget: 150,
    });
    expect(summarize([150]).over).toBe(0);
    expect(() => percentile([], 0.5)).toThrow();
  });
});
