// Written keys and spellings of transposing staves (ADR-0002 A22).
import { describe, expect, it } from 'vitest';
import type { KeySignature, MasterBar, Note } from '../schema/document.js';
import { deepFreeze, testId } from '../test-support/builders.js';
import {
  concertKeyAt,
  writtenKeyAt,
  writtenKeyShift,
  writtenKeySignature,
  writtenPitch,
  writtenSpelling,
} from './transposition.js';

type Spelling = NonNullable<Note['spelling']>;
const major = (fifths: number): KeySignature => ({ fifths, mode: 'major' });

// sounding = written + t
const B_FLAT_CLARINET = -2;
const A_CLARINET = -3;
const F_HORN = -7;
const E_FLAT_ALTO_SAX = -9;
const GUITAR = -12;
const TENOR_SAX = -14;
const PICCOLO = 12;

describe('writtenKeySignature: the approved example table', () => {
  const columns = [
    0,
    B_FLAT_CLARINET,
    A_CLARINET,
    F_HORN,
    E_FLAT_ALTO_SAX,
    GUITAR,
    TENOR_SAX,
    PICCOLO,
  ];
  const table: [string, number, number[]][] = [
    ['C', 0, [0, 2, -3, 1, 3, 0, 2, 0]],
    ['E♭', -3, [-3, -1, -6, -2, 0, -3, -1, -3]],
    ['E', 4, [4, 6, 1, 5, -5, 4, 6, 4]],
    ['F♯', 6, [6, -4, 3, -5, -3, 6, -4, 6]],
  ];
  for (const [name, concert, expected] of table) {
    it(`concert ${name}`, () => {
      expect(columns.map((t) => writtenKeySignature(major(concert), t).fifths)).toEqual(expected);
    });
  }
});

describe('writtenKeySignature: rules', () => {
  it('breaks a ±6 tie with the concert key sign', () => {
    expect(writtenKeySignature(major(-3), A_CLARINET)).toEqual(major(-6)); // E♭ → G♭
    expect(writtenKeySignature(major(4), B_FLAT_CLARINET)).toEqual(major(6)); // E → F♯
  });

  it('uses sharps for a tie from concert C (tritone shift)', () => {
    expect(writtenKeySignature(major(0), -6)).toEqual(major(6));
    expect(writtenKeySignature(major(0), 6)).toEqual(major(6));
  });

  it('keeps the mode', () => {
    expect(writtenKeySignature({ fifths: -3, mode: 'minor' }, B_FLAT_CLARINET)).toEqual({
      fifths: -1,
      mode: 'minor',
    });
  });

  it('leaves octave transpositions unchanged', () => {
    for (const t of [0, 12, -12, 24, -24, 36, -48]) {
      expect(writtenKeySignature(major(3), t)).toEqual(major(3));
      expect(writtenKeyShift(major(3), t)).toBe(0);
    }
  });

  it('yields at most 6 accidentals for a non-octave shift', () => {
    for (let fifths = -7; fifths <= 7; fifths++) {
      for (let t = -48; t <= 48; t++) {
        const written = writtenKeySignature(major(fifths), t).fifths;
        // A non-octave shift picks the enharmonic with the fewest accidentals (at most 6).
        if (t % 12 !== 0) expect(Math.abs(written)).toBeLessThanOrEqual(6);
        else expect(written).toBe(fifths);
      }
    }
  });
});

describe('written keys in a document', () => {
  const masterBars: MasterBar[] = deepFreeze([
    {
      id: testId(),
      timeSignature: { numerator: 4, denominator: 4 },
      keySignature: major(0),
      tempoChanges: [{ position: [0, 1], bpm: 120 }],
    },
    { id: testId() },
    { id: testId(), keySignature: major(-3) },
    { id: testId() },
  ]);

  it('derives each staff of a mixed score independently', () => {
    const staves = [
      {},
      { transpositionPitch: B_FLAT_CLARINET },
      { transpositionPitch: E_FLAT_ALTO_SAX },
    ];
    expect(staves.map((staff) => writtenKeyAt(masterBars, 1, staff).fifths)).toEqual([0, 2, 3]);
    expect(staves.map((staff) => writtenKeyAt(masterBars, 3, staff).fifths)).toEqual([-3, -1, 0]);
  });

  it('gives both staves of a grand staff the same key when they share the transposition', () => {
    const upper = { transpositionPitch: F_HORN };
    const lower = { transpositionPitch: F_HORN };
    expect(writtenKeyAt(masterBars, 0, upper)).toEqual(writtenKeyAt(masterBars, 0, lower));
  });

  it('follows a key change on every staff at the bar where the concert key changes', () => {
    expect(concertKeyAt(masterBars, 1)).toEqual(major(0));
    expect(concertKeyAt(masterBars, 2)).toEqual(major(-3));
    const clarinet = { transpositionPitch: B_FLAT_CLARINET };
    expect([0, 1, 2, 3].map((b) => writtenKeyAt(masterBars, b, clarinet).fifths)).toEqual([
      2, 2, -1, -1,
    ]);
  });
});

describe('writtenSpelling', () => {
  const FIFTHS: Record<string, number> = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5 };
  const lineOfFifths = (s: Spelling) => (FIFTHS[s.step] ?? 0) + 7 * s.alter;
  const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const pitchClass = (s: Spelling) => ((((PITCH_CLASS[s.step] ?? 0) + s.alter) % 12) + 12) % 12;

  it('spells a B♭ clarinet a major second higher', () => {
    expect(writtenSpelling({ step: 'C', alter: 0 }, major(0), B_FLAT_CLARINET)).toEqual({
      step: 'D',
      alter: 0,
    });
    expect(writtenSpelling({ step: 'B', alter: -1 }, major(-2), B_FLAT_CLARINET)).toEqual({
      step: 'C',
      alter: 0,
    });
  });

  it('follows an enharmonic written key: concert B for B♭ clarinet is written in D♭', () => {
    const key = major(5);
    expect(writtenKeySignature(key, B_FLAT_CLARINET).fifths).toBe(-5);
    expect(writtenSpelling({ step: 'B', alter: 0 }, key, B_FLAT_CLARINET)).toEqual({
      step: 'D',
      alter: -1,
    });
    expect(writtenSpelling({ step: 'D', alter: 1 }, key, B_FLAT_CLARINET)).toEqual({
      step: 'F',
      alter: 0,
    });
  });

  it('agrees with the written key and keeps the pitch class of the written pitch', () => {
    for (let fifths = -7; fifths <= 7; fifths++) {
      for (const t of [B_FLAT_CLARINET, A_CLARINET, F_HORN, E_FLAT_ALTO_SAX, TENOR_SAX, -6]) {
        const key = major(fifths);
        const shift = writtenKeyShift(key, t);
        for (const step of ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const) {
          for (const alter of [-1, 0, 1]) {
            const sounding: Spelling = { step, alter };
            const written = writtenSpelling(sounding, key, t);
            expect(Math.abs(written.alter)).toBeLessThanOrEqual(2);
            expect(pitchClass(written)).toBe((((pitchClass(sounding) - t) % 12) + 12) % 12);
            const target = lineOfFifths(sounding) + shift;
            if (target >= -15 && target <= 19) {
              // No fallback needed: the note moves by exactly the key's fifths shift.
              expect(lineOfFifths(written)).toBe(target);
            }
          }
        }
      }
    }
  });

  it('falls back to an enharmonic when a double accidental is not enough', () => {
    // Concert B𝄪 (line of fifths 19) in E major, B♭ clarinet (+2 fifths): C𝄪♯ would need a triple
    // sharp, so the same pitch class D♯ is used, the candidate closest to the written key F♯.
    expect(writtenKeySignature(major(4), B_FLAT_CLARINET).fifths).toBe(6);
    expect(writtenSpelling({ step: 'B', alter: 2 }, major(4), B_FLAT_CLARINET)).toEqual({
      step: 'D',
      alter: 1,
    });
  });

  it('never changes the sounding data', () => {
    const sounding = deepFreeze({ step: 'E', alter: -1 } as Spelling);
    const key = deepFreeze(major(-3));
    writtenSpelling(sounding, key, E_FLAT_ALTO_SAX);
    expect(sounding).toEqual({ step: 'E', alter: -1 });
    expect(writtenPitch(60, B_FLAT_CLARINET)).toBe(62);
    expect(writtenPitch(60, GUITAR)).toBe(72);
  });
});
