import { describe, expect, it } from 'vitest';
import bandExpected from '../fixtures/v1/band-repeats.expected.json' with { type: 'json' };
import band from '../fixtures/v1/band-repeats.mhd.json' with { type: 'json' };
import guitarExpected from '../fixtures/v1/guitar-basic.expected.json' with { type: 'json' };
import guitar from '../fixtures/v1/guitar-basic.mhd.json' with { type: 'json' };
import notationExpected from '../fixtures/v1/notation-semantics.expected.json' with { type: 'json' };
import notation from '../fixtures/v1/notation-semantics.mhd.json' with { type: 'json' };
import pianoExpected from '../fixtures/v1/piano-grand-staff.expected.json' with { type: 'json' };
import piano from '../fixtures/v1/piano-grand-staff.mhd.json' with { type: 'json' };
import { effectiveDynamics } from './derive/dynamics.js';
import { writtenKeyAt, writtenSpelling, concertKeyAt } from './derive/transposition.js';
import type { MhdDocument } from './schema/document.js';
import { FixtureExpectationSchema, countStructure } from './test-support/fixture-stats.js';
import { ISSUE_CODES } from './validate/issues.js';
import { validateDocument } from './validate/validate-document.js';

// JSON imports are not typed as MhdDocument, so fixtures go through validateDocument as unknown.
const FIXTURES: readonly { file: string; source: unknown; expected: unknown }[] = [
  { file: 'guitar-basic.mhd.json', source: guitar, expected: guitarExpected },
  { file: 'piano-grand-staff.mhd.json', source: piano, expected: pianoExpected },
  { file: 'band-repeats.mhd.json', source: band, expected: bandExpected },
  { file: 'notation-semantics.mhd.json', source: notation, expected: notationExpected },
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

describe('fixture D (notation semantics)', () => {
  const doc = must(validateDocument(notation).document);
  const clarinet = must(doc.tracks[0]);
  const piano = must(doc.tracks[1]);
  const clarinetStaff = must(clarinet.staves[0]);
  const beatsOf = (staff: number, bar: number, voice = 0, track = clarinet) =>
    must(must(must(track.staves[staff]).bars[bar]).voices[voice]).beats;

  it('holds overlapping, nested, chained, cross-voice and cross-staff slurs', () => {
    expect(clarinet.slurs).toHaveLength(4);
    expect(piano.slurs).toHaveLength(2);
  });

  it('holds tenuto alone, with an accent and with staccato', () => {
    const effects = doc.tracks
      .flatMap((t) => t.staves)
      .flatMap((s) => s.bars)
      .flatMap((b) => b.voices)
      .flatMap((v) => v.beats)
      .flatMap((b) => b.notes)
      .map((n) => n.effects)
      .filter((e) => e?.tenuto === true);
    expect(effects).toEqual([
      { tenuto: true },
      { tenuto: true, accent: 'normal' },
      { tenuto: true, staccato: true },
    ]);
  });

  it('derives the written keys of the B♭ clarinet from the concert keys', () => {
    expect([0, 1, 2].map((bar) => concertKeyAt(doc.masterBars, bar).fifths)).toEqual([-1, -1, 2]);
    expect([0, 1, 2].map((bar) => writtenKeyAt(doc.masterBars, bar, clarinetStaff).fifths)).toEqual(
      [1, 1, 4],
    );
    expect(writtenKeyAt(doc.masterBars, 2, must(piano.staves[0])).fifths).toBe(2);
    const fSharp = must(must(beatsOf(0, 2)[0]).notes[0]);
    expect(writtenSpelling(must(fSharp.spelling), concertKeyAt(doc.masterBars, 2), -2)).toEqual({
      step: 'G',
      alter: 1,
    });
  });

  it('carries dynamics per voice from the default f', () => {
    const clarinetDynamics = effectiveDynamics(clarinetStaff);
    expect([...beatsOf(0, 0), ...beatsOf(0, 2)].map((b) => clarinetDynamics.get(b.id))).toEqual([
      'p',
      'p',
      'p',
      'p',
      'mf',
      'mf',
      'mf',
    ]);
    const upper = effectiveDynamics(must(piano.staves[0]));
    expect(beatsOf(0, 1, 0, piano).map((b) => upper.get(b.id))).toEqual(['mp', 'mp']);
    expect(beatsOf(0, 1, 1, piano).map((b) => upper.get(b.id))).toEqual(['f', 'f']);
    expect(beatsOf(0, 2, 0, piano).map((b) => upper.get(b.id))).toEqual(['mp', 'mp', 'mp']);
  });

  it('reports a slur whose note was deleted', () => {
    const changed = mutate(notation, (d) => {
      const beat = must(must(must(must(must(d.tracks[0]).staves[0]).bars[0]).voices[0]).beats[2]);
      beat.rest = true;
      beat.notes = [];
    });
    expectIssue(changed, ISSUE_CODES.slurEndpointMissing, ['tracks', 0, 'slurs', 0, 'to']);
  });

  it('reports a slur that runs backwards', () => {
    const changed = mutate(notation, (d) => {
      const slur = must(must(d.tracks[0]).slurs?.[0]);
      [slur.from, slur.to] = [slur.to, slur.from];
    });
    expectIssue(changed, ISSUE_CODES.slurOrderInvalid, ['tracks', 0, 'slurs', 0]);
  });
});
