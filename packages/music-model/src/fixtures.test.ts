import { describe, expect, it } from 'vitest';
import bandExpected from '../fixtures/v1/band-repeats.expected.json' with { type: 'json' };
import band from '../fixtures/v1/band-repeats.mhd.json' with { type: 'json' };
import guitarExpected from '../fixtures/v1/guitar-basic.expected.json' with { type: 'json' };
import guitar from '../fixtures/v1/guitar-basic.mhd.json' with { type: 'json' };
import pianoExpected from '../fixtures/v1/piano-grand-staff.expected.json' with { type: 'json' };
import piano from '../fixtures/v1/piano-grand-staff.mhd.json' with { type: 'json' };
import type { MhdDocument } from './schema/document.js';
import { FixtureExpectationSchema, countStructure } from './test-support/fixture-stats.js';
import { ISSUE_CODES } from './validate/issues.js';
import { validateDocument } from './validate/validate-document.js';

// JSON imports are not typed as MhdDocument, so fixtures go through validateDocument as unknown.
const FIXTURES: readonly { file: string; source: unknown; expected: unknown }[] = [
  { file: 'guitar-basic.mhd.json', source: guitar, expected: guitarExpected },
  { file: 'piano-grand-staff.mhd.json', source: piano, expected: pianoExpected },
  { file: 'band-repeats.mhd.json', source: band, expected: bandExpected },
];

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('fixture structure changed: expected a value');
  return value;
}

/** Deep copy of a canonical fixture, changed in memory only (the imported fixture stays intact). */
function mutate(source: unknown, change: (doc: MhdDocument) => void): unknown {
  const doc = JSON.parse(JSON.stringify(source)) as MhdDocument;
  change(doc);
  return doc;
}

function expectIssue(doc: unknown, code: string, path: readonly (string | number)[]): void {
  expect(validateDocument(doc).issues).toContainEqual(expect.objectContaining({ code, path }));
}

describe.each(FIXTURES)('canonical fixture $file', ({ file, source, expected }) => {
  const result = validateDocument(source);
  const sidecar = FixtureExpectationSchema.parse(expected);

  it('is valid with zero issues (warnings included)', () => {
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('matches the validation result recorded in its sidecar', () => {
    expect(sidecar.fixture).toBe(file);
    expect(sidecar.schemaVersion).toBe(result.document?.schemaVersion);
    expect(sidecar.validation).toEqual({
      valid: result.valid,
      issueCodes: result.issues.map((issue) => issue.code),
    });
  });

  it('matches the structural counts recorded in its sidecar', () => {
    expect(countStructure(must(result.document))).toEqual(sidecar.counts);
  });
});

describe('sidecar schema', () => {
  it('rejects unknown keys and derived playback data', () => {
    const withPlayback = { ...guitarExpected, playbackOrder: [0, 1, 2, 3] };
    expect(FixtureExpectationSchema.safeParse(withPlayback).success).toBe(false);
  });
});

describe('fixture A (guitar) negative mutations', () => {
  const BAR = (bar: number) => ['tracks', 0, 'staves', 0, 'bars', bar, 'voices', 0];
  const beatsOf = (doc: MhdDocument, bar: number) =>
    must(must(must(must(doc.tracks[0]).staves[0]).bars[bar]).voices[0]).beats;

  it('reports two notes on the same string in one beat', () => {
    const doc = mutate(guitar, (d) => {
      must(must(beatsOf(d, 0)[3]).notes[1]).string = 1;
    });
    expectIssue(doc, ISSUE_CODES.duplicateStringInBeat, [
      ...BAR(0),
      'beats',
      3,
      'notes',
      1,
      'string',
    ]);
  });

  it('reports a fret above fretCount', () => {
    const doc = mutate(guitar, (d) => {
      must(must(beatsOf(d, 0)[1]).notes[0]).fret = 25;
    });
    expectIssue(doc, ISSUE_CODES.fretOutOfRange, [...BAR(0), 'beats', 1, 'notes', 0, 'fret']);
  });

  it('reports a tie to the same pitch on another string', () => {
    // String 1 fret 12 and string 2 fret 17 both sound 78 with capo 2.
    const doc = mutate(guitar, (d) => {
      Object.assign(must(must(beatsOf(d, 3)[0]).notes[0]), { string: 2, fret: 17 });
    });
    expectIssue(doc, ISSUE_CODES.tieStringFretMismatch, [
      ...BAR(3),
      'beats',
      0,
      'notes',
      0,
      'tiedFromPrevious',
    ]);
  });

  it('reports a voice longer than its bar', () => {
    const doc = mutate(guitar, (d) => {
      beatsOf(d, 3).push({
        id: 'GAX000000001',
        duration: { value: 4, dots: 0 },
        rest: true,
        notes: [],
      });
    });
    expectIssue(doc, ISSUE_CODES.voiceOverfull, BAR(3));
  });
});

describe('fixture B (piano) negative mutations', () => {
  const PEDAL = ['tracks', 0, 'staves', 1, 'bars', 0, 'sustainPedal'];
  const pedalsOf = (doc: MhdDocument) =>
    must(must(must(must(doc.tracks[0]).staves[1]).bars[0]).sustainPedal);

  it('reports a pedal up without a preceding down', () => {
    const doc = mutate(piano, (d) => {
      must(pedalsOf(d)[0]).type = 'up';
    });
    expectIssue(doc, ISSUE_CODES.pedalSequenceInvalid, [...PEDAL, 0, 'type']);
  });

  it('reports non-increasing pedal positions', () => {
    const doc = mutate(piano, (d) => {
      must(pedalsOf(d)[2]).position = [1, 2];
    });
    expectIssue(doc, ISSUE_CODES.positionsNotIncreasing, [...PEDAL, 2, 'position']);
  });

  it('reports hand assignment when the track is a guitar', () => {
    const doc = mutate(piano, (d) => {
      must(d.tracks[0]).instrument.family = 'guitar';
    });
    expectIssue(doc, ISSUE_CODES.keyboardOnlyHand, ['tracks', 0, 'staves', 0, 'hand']);
  });

  it('reports a third staff on a keyboard track', () => {
    const doc = mutate(piano, (d) => {
      const track = must(d.tracks[0]);
      track.staves.push({
        id: 'PBX000000001',
        display: { standard: true, tab: false, slash: false, numbered: false },
        bars: [1, 2, 3].map((bar) => ({
          id: `PBX00000001${bar}`,
          voices: [
            {
              id: `PBX00000002${bar}`,
              beats: [
                {
                  id: `PBX00000003${bar}`,
                  duration: { value: 1, dots: 0 },
                  rest: true,
                  notes: [],
                },
              ],
            },
          ],
        })),
      });
    });
    expectIssue(doc, ISSUE_CODES.keyboardStaffCount, ['tracks', 0, 'staves']);
  });
});

describe('fixture C (band) negative mutations', () => {
  const masterBar = (doc: MhdDocument, index: number) => must(doc.masterBars[index]);

  it('rejects a repeat count of 1', () => {
    const doc = mutate(band, (d) => {
      masterBar(d, 2).repeatEnd = { count: 1 };
    });
    expectIssue(doc, 'schema.too_small', ['masterBars', 2, 'repeatEnd', 'count']);
  });

  it('reports an alternate ending above the repeat count', () => {
    const doc = mutate(band, (d) => {
      masterBar(d, 3).alternateEndings = [3];
    });
    expectIssue(doc, ISSUE_CODES.alternateEndingExceedsCount, [
      'masterBars',
      3,
      'alternateEndings',
    ]);
  });

  it('reports D.S. al Coda without a segno', () => {
    const doc = mutate(band, (d) => {
      delete masterBar(d, 4).direction;
    });
    expectIssue(doc, ISSUE_CODES.directionTargetMissing, ['masterBars', 6, 'direction']);
  });

  it('reports a drums track without percussion: true', () => {
    const doc = mutate(band, (d) => {
      must(d.tracks[2]).instrument.percussion = false;
    });
    expectIssue(doc, ISSUE_CODES.drumsNotPercussion, ['tracks', 2, 'instrument', 'percussion']);
  });

  it('reports a drum technique that does not fit the GM key', () => {
    const doc = mutate(band, (d) => {
      const beat = must(must(must(must(must(d.tracks[2]).staves[0]).bars[0]).voices[0]).beats[0]);
      must(beat.notes[1]).drumTechnique = 'rimshot';
    });
    expectIssue(doc, ISSUE_CODES.drumTechniquePitchMismatch, [
      'tracks',
      2,
      'staves',
      0,
      'bars',
      0,
      'voices',
      0,
      'beats',
      0,
      'notes',
      1,
      'drumTechnique',
    ]);
  });
});

describe('canonical fixtures stay untouched by mutations', () => {
  it('still validates every imported fixture without issues', () => {
    for (const { source } of FIXTURES) expect(validateDocument(source).issues).toEqual([]);
  });
});
