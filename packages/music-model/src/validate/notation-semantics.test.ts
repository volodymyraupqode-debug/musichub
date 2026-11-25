// Tenuto and slurs (MUSIC_ENGINE.md §3.2, invariant 16; ADR-0002 A20, A21).
import { describe, expect, it } from 'vitest';
import type { MhdDocument, Note, Slur, Track } from '../schema/document.js';
import {
  bar,
  beat,
  documentWith,
  note,
  pitchStaff,
  testId,
  track,
} from '../test-support/builders.js';
import { ISSUE_CODES } from './issues.js';
import { validateDocument } from './validate-document.js';

const codesOf = (doc: unknown) => validateDocument(doc).issues.map((issue) => issue.code);

function expectClean(doc: unknown) {
  const result = validateDocument(doc);
  expect(result.issues).toEqual([]);
  expect(result.valid).toBe(true);
}

/** Four quarter notes per bar on every staff; `notes[staff][bar][beat]` gives their ids. */
function pianoDocument(barCount = 2, extraVoice = false) {
  const notes: Note[][][] = [];
  const staves = [0, 1].map((staffIndex) => {
    const staffNotes: Note[][] = [];
    const bars = Array.from({ length: barCount }, (_, b) => {
      const barNotes = [0, 1, 2, 3].map((i) => note({ pitch: 60 - 12 * staffIndex + i + b }));
      staffNotes.push(barNotes);
      const staffBar = bar(barNotes.map((n) => beat(4, [n])));
      if (extraVoice && staffIndex === 0) {
        const second = [0, 1].map((i) => note({ pitch: 72 + i }));
        staffNotes.push(second);
        staffBar.voices.push({ id: testId(), beats: second.map((n) => beat(2, [n])) });
      }
      return staffBar;
    });
    notes.push(staffNotes);
    return pitchStaff(bars, { hand: staffIndex === 0 ? 'right' : 'left' });
  });
  const piano = track('piano', staves);
  return { doc: documentWith([piano]), notes, piano };
}

function withSlurs(doc: MhdDocument, slurs: [string, string][], trackIndex = 0): MhdDocument {
  const tracks: Track[] = doc.tracks.map((t, i) =>
    i === trackIndex
      ? { ...t, slurs: slurs.map(([from, to]): Slur => ({ id: testId(), from, to })) }
      : t,
  );
  return { ...doc, tracks };
}

const id = (n: Note | undefined): string => {
  if (!n) throw new Error('missing note in test document');
  return n.id;
};

describe('tenuto (ADR-0002 A20)', () => {
  it('accepts tenuto alone, with accent and with staccato', () => {
    const alone = note({ pitch: 60, effects: { tenuto: true } });
    const withAccent = note({ pitch: 62, effects: { tenuto: true, accent: 'heavy' } });
    const withStaccato = note({ pitch: 64, effects: { tenuto: true, staccato: true } });
    expectClean(
      documentWith([
        track('piano', [
          pitchStaff([bar([beat(2, [alone]), beat(4, [withAccent]), beat(4, [withStaccato])])]),
        ]),
      ]),
    );
  });

  it('rejects tenuto: false (optional flags are true or absent)', () => {
    const doc = documentWith([
      track('piano', [
        pitchStaff([
          bar([beat(1, [note({ pitch: 60, effects: { tenuto: false as unknown as true } })])]),
        ]),
      ]),
    ]);
    expect(codesOf(doc)).toContain('schema.invalid_value');
  });
});

describe('slur schema', () => {
  it('rejects an empty slur list and unknown keys', () => {
    const { doc } = pianoDocument(1);
    expect(codesOf(withSlurs(doc, []))).toContain('schema.too_small');
    const extra = {
      ...doc,
      tracks: [
        { ...doc.tracks[0], slurs: [{ id: testId(), from: 'a', to: 'b', placement: 'above' }] },
      ],
    };
    expect(codesOf(extra)).toContain('schema.unrecognized_keys');
  });
});

describe('invariant 16: slurs connect notes of one track in score order', () => {
  it('accepts a single slur and a slur across a bar line', () => {
    const { doc, notes } = pianoDocument();
    expectClean(withSlurs(doc, [[id(notes[0]?.[0]?.[0]), id(notes[0]?.[0]?.[3])]]));
    expectClean(withSlurs(doc, [[id(notes[0]?.[0]?.[2]), id(notes[0]?.[1]?.[1])]]));
  });

  it('accepts chained, overlapping and nested slurs and several slurs per note', () => {
    const { doc, notes } = pianoDocument();
    const n = (b: number, i: number) => id(notes[0]?.[b]?.[i]);
    expectClean(
      withSlurs(doc, [
        [n(0, 0), n(0, 1)], // chained: A–B, B–C
        [n(0, 1), n(0, 2)],
        [n(0, 0), n(0, 2)], // overlapping A–C and B–D
        [n(0, 1), n(0, 3)],
        [n(0, 0), n(1, 3)], // nested phrase slur around the short slurs
        [n(1, 1), n(1, 2)],
      ]),
    );
  });

  it('accepts slurs across voices and across the staves of a grand staff', () => {
    const { doc, notes } = pianoDocument(2, true);
    // notes[0] = staff 0: [bar0 voice0, bar0 voice1, bar1 voice0, bar1 voice1]
    expectClean(
      withSlurs(doc, [
        [id(notes[0]?.[0]?.[0]), id(notes[0]?.[1]?.[1])], // voice 0 → voice 1 (half note at 1/2)
        [id(notes[0]?.[0]?.[1]), id(notes[1]?.[0]?.[3])], // upper staff → lower staff
      ]),
    );
  });

  it('accepts slurs on a percussion track', () => {
    const drums = [note({ pitch: 38 }), note({ pitch: 38 })];
    const percussion = track('drums', [pitchStaff([bar(drums.map((d) => beat(2, [d])))])], true);
    expectClean(withSlurs(documentWith([percussion]), [[id(drums[0]), id(drums[1])]]));
  });

  it('accepts a slur from a grace note to its main note, and orders a grace run', () => {
    const firstGrace = note({ pitch: 59 });
    const secondGrace = note({ pitch: 60 });
    const graces = [firstGrace, secondGrace];
    const main = note({ pitch: 62 });
    const t = track('piano', [
      pitchStaff([
        bar([
          beat(16, [firstGrace], { grace: 'beforeBeat' }),
          beat(16, [secondGrace], { grace: 'beforeBeat' }),
          beat(1, [main]),
        ]),
      ]),
    ]);
    const doc = documentWith([t]);
    expectClean(withSlurs(doc, [[id(graces[0]), id(main)]]));
    expectClean(withSlurs(doc, [[id(graces[0]), id(graces[1])]]));
    expect(codesOf(withSlurs(doc, [[id(main), id(graces[1])]]))).toEqual([
      ISSUE_CODES.slurOrderInvalid,
    ]);
  });

  it('orders a trailing grace beat at the voice end, before the next bar (Q4)', () => {
    const first = note({ pitch: 60 });
    const trailing = note({ pitch: 62 });
    const next = note({ pitch: 64 });
    const t = track('piano', [
      pitchStaff([
        bar([beat(1, [first]), beat(16, [trailing], { grace: 'beforeBeat' })]),
        bar([beat(1, [next])]),
      ]),
    ]);
    const doc = documentWith([t]);
    expectClean(withSlurs(doc, [[id(first), id(trailing)]]));
    expectClean(withSlurs(doc, [[id(trailing), id(next)]]));
    expect(codesOf(withSlurs(doc, [[id(trailing), id(first)]]))).toEqual([
      ISSUE_CODES.slurOrderInvalid,
    ]);
  });

  it('rejects endpoints that are not notes', () => {
    const { doc, notes } = pianoDocument();
    const beatId = doc.tracks[0]?.staves[0]?.bars[0]?.voices[0]?.beats[0]?.id ?? '';
    const result = validateDocument(
      withSlurs(doc, [
        [beatId, id(notes[0]?.[0]?.[1])],
        [id(notes[0]?.[0]?.[0]), 'zzzzzzzzzzzz'],
      ]),
    );
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: ISSUE_CODES.slurEndpointMissing,
        path: ['tracks', 0, 'slurs', 0, 'from'],
      }),
      expect.objectContaining({
        code: ISSUE_CODES.slurEndpointMissing,
        path: ['tracks', 0, 'slurs', 1, 'to'],
      }),
    ]);
  });

  it('rejects an endpoint in another track', () => {
    const { piano, notes } = pianoDocument(1);
    const other = note({ pitch: 40 });
    const bass = track('bass', [pitchStaff([bar([beat(1, [other])])])]);
    const doc = withSlurs(documentWith([piano, bass]), [[id(notes[0]?.[0]?.[0]), other.id]]);
    expect(validateDocument(doc).issues).toEqual([
      expect.objectContaining({
        code: ISSUE_CODES.slurEndpointOtherTrack,
        path: ['tracks', 0, 'slurs', 0, 'to'],
      }),
    ]);
  });

  it('rejects a slur that goes backwards, to the same note, or within one chord or onset', () => {
    const { doc, notes } = pianoDocument();
    const n = (s: number, b: number, i: number) => id(notes[s]?.[b]?.[i]);
    for (const pair of [
      [n(0, 0, 2), n(0, 0, 1)], // backwards
      [n(0, 0, 1), n(0, 0, 1)], // same note
      [n(0, 0, 1), n(1, 0, 1)], // same onset on the other staff
    ] as [string, string][]) {
      expect(codesOf(withSlurs(doc, [pair]))).toEqual([ISSUE_CODES.slurOrderInvalid]);
    }
    const chord = [note({ pitch: 60 }), note({ pitch: 64 })];
    const chordDoc = documentWith([track('piano', [pitchStaff([bar([beat(1, chord)])])])]);
    expect(codesOf(withSlurs(chordDoc, [[id(chord[0]), id(chord[1])]]))).toEqual([
      ISSUE_CODES.slurOrderInvalid,
    ]);
  });

  it('rejects two slurs with the same first and last note', () => {
    const { doc, notes } = pianoDocument();
    const pair: [string, string] = [id(notes[0]?.[0]?.[0]), id(notes[0]?.[0]?.[2])];
    expect(validateDocument(withSlurs(doc, [pair, pair])).issues).toEqual([
      expect.objectContaining({ code: ISSUE_CODES.slurDuplicate, path: ['tracks', 0, 'slurs', 1] }),
    ]);
  });

  it('counts slur ids for invariant 1', () => {
    const { doc, notes } = pianoDocument();
    const slurred = withSlurs(doc, [[id(notes[0]?.[0]?.[0]), id(notes[0]?.[0]?.[1])]]);
    const clash = {
      ...slurred,
      tracks: slurred.tracks.map((t) => ({
        ...t,
        slurs: t.slurs?.map((s) => ({ ...s, id: id(notes[0]?.[0]?.[3]) })),
      })),
    };
    expect(codesOf(clash)).toEqual([ISSUE_CODES.duplicateId]);
  });

  it('regression: deleting a slurred note makes the document invalid', () => {
    const { doc, notes } = pianoDocument();
    const to = notes[0]?.[0]?.[3];
    const slurred = withSlurs(doc, [[id(notes[0]?.[0]?.[0]), id(to)]]);
    expectClean(slurred);
    const deleted = JSON.parse(JSON.stringify(slurred)) as MhdDocument;
    const voice = deleted.tracks[0]?.staves[0]?.bars[0]?.voices[0];
    if (!voice) throw new Error('voice missing');
    voice.beats[3] = { id: testId(), duration: { value: 4, dots: 0 }, rest: true, notes: [] };
    expect(codesOf(deleted)).toEqual([ISSUE_CODES.slurEndpointMissing]);
  });
});
