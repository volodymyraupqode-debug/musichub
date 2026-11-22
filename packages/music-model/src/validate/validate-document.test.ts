import { describe, expect, it } from 'vitest';
import type { MasterBar, MhdDocument } from '../schema/document.js';
import {
  bar,
  beat,
  deepFreeze,
  documentWith,
  guitarStaff,
  minimalDocument,
  note,
  pitchStaff,
  rest,
  testId,
  track,
} from '../test-support/builders.js';
import { ISSUE_CODES } from './issues.js';
import { validateDocument } from './validate-document.js';

const NOTE_0 = ['tracks', 0, 'staves', 0, 'bars', 0, 'voices', 0, 'beats', 0, 'notes', 0];
const VOICE_0 = ['tracks', 0, 'staves', 0, 'bars', 0, 'voices', 0];

function issuesOf(doc: unknown) {
  return validateDocument(doc).issues;
}

function expectClean(doc: unknown) {
  const result = validateDocument(doc);
  expect(result.issues).toEqual([]);
  expect(result.valid).toBe(true);
}

function expectIssue(
  doc: unknown,
  code: string,
  path: readonly (string | number)[],
  severity = 'error',
) {
  const issues = issuesOf(doc);
  expect(issues).toContainEqual(expect.objectContaining({ code, path, severity }));
}

function piano(
  staffBars: Parameters<typeof bar>[0][][],
  extraTrack: Partial<ReturnType<typeof track>> = {},
) {
  const staves = staffBars.map((bars, index) =>
    pitchStaff(
      bars.map((beats) => bar(beats)),
      { hand: index === 0 ? 'right' : 'left' },
    ),
  );
  return { ...track('piano', staves), ...extraTrack };
}

function masterBars(doc: MhdDocument, changes: Partial<Omit<MasterBar, 'id'>>[]): MhdDocument {
  const bars = changes.map((change, index) => ({
    ...(index === 0 ? doc.masterBars[0] : { id: testId() }),
    ...change,
  }));
  const tracks = doc.tracks.map((t) => ({
    ...t,
    staves: t.staves.map((staff) => ({ ...staff, bars: changes.map(() => bar([rest(1)])) })),
  }));
  return { ...doc, masterBars: bars as MasterBar[], tracks };
}

describe('validateDocument: result shape and purity', () => {
  it('accepts a valid v1 document', () => {
    const doc = minimalDocument();
    const result = validateDocument(doc);
    expect(result).toMatchObject({ valid: true, issues: [] });
    expect(result.document).toEqual(doc);
  });

  it('rejects a newer schema version with an update hint and no other issues', () => {
    const result = validateDocument({
      ...minimalDocument(),
      schemaVersion: 2,
      unknownV2Field: true,
    });
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: ISSUE_CODES.unsupportedSchemaVersion,
        path: ['schemaVersion'],
        severity: 'error',
      }),
    ]);
    expect(result.issues[0]?.message).toMatch(/Update MusicHub/);
  });

  it('reports schema issues as schema.<code> with paths and skips cross-field checks', () => {
    const doc = { ...minimalDocument(), extra: 1, masterBars: [] };
    const result = validateDocument(doc);
    expect(result.valid).toBe(false);
    expect(result.document).toBeUndefined();
    expect(
      result.issues.every(
        (issue) => issue.code.startsWith('schema.') && issue.severity === 'error',
      ),
    ).toBe(true);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'schema.unrecognized_keys', path: [] }),
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'schema.too_small', path: ['masterBars'] }),
    );
  });

  it.each([[null], ['text'], [42], [[]], [{ schemaVersion: 'x' }]])(
    'rejects non-document input %j',
    (input) => {
      expect(validateDocument(input).valid).toBe(false);
    },
  );

  it('does not mutate the input, keeps extensions verbatim and generates no ids', () => {
    const doc = deepFreeze({
      ...minimalDocument(),
      extensions: { 'alphatab.unmapped': { T00000000001: { raw: [1, 2, { deep: null }] } } },
    });
    const before = JSON.stringify(doc);
    const result = validateDocument(doc);
    expect(result.valid).toBe(true);
    expect(JSON.stringify(doc)).toBe(before);
    expect(JSON.stringify(result.document)).toBe(before);
    expect(result.document?.extensions).toEqual(doc.extensions);
  });

  it('keeps warnings without making the document invalid', () => {
    const doc = documentWith([
      track('guitar', [guitarStaff([bar([beat(2, [note({ string: 1, fret: 0 })])])])]),
    ]);
    const result = validateDocument(doc);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([
      expect.objectContaining({ code: ISSUE_CODES.voiceIncomplete, severity: 'warning' }),
    ]);
  });
});

describe('invariant 1: ids are unique within the document', () => {
  it('accepts distinct ids', () => expectClean(minimalDocument()));

  it('reports a duplicate id at its second location', () => {
    const doc = minimalDocument();
    const target = doc.tracks[0]?.staves[0]?.bars[0]?.voices[0]?.beats[0]?.notes[0];
    if (target) target.id = doc.tracks[0]?.id ?? '';
    expectIssue(doc, ISSUE_CODES.duplicateId, [...NOTE_0, 'id']);
  });

  it('includes the document id', () => {
    const doc = minimalDocument();
    const first = doc.masterBars[0];
    if (first) first.id = doc.id;
    expectIssue(doc, ISSUE_CODES.duplicateId, ['masterBars', 0, 'id']);
  });
});

describe('invariant 2: every staff has one bar per master bar', () => {
  it('accepts equal counts', () => {
    expectClean(documentWith([track('guitar', [guitarStaff([bar([rest()]), bar([rest()])])])], 2));
  });

  it('reports a mismatch', () => {
    const doc = documentWith([track('guitar', [guitarStaff([bar([rest()])])])], 2);
    expectIssue(doc, ISSUE_CODES.barCountMismatch, ['tracks', 0, 'staves', 0, 'bars']);
  });
});

describe('invariant 3: voice length', () => {
  const guitarWith = (...beats: ReturnType<typeof beat>[]) =>
    documentWith([track('guitar', [guitarStaff([bar(beats)])])]);
  const open = () => [note({ string: 1, fret: 0 })];

  it('accepts exact fills with dots, tuplets and grace notes', () => {
    const triplet = (extra = {}) => ({
      ...beat(4, open()),
      duration: { value: 4 as const, dots: 0 as const, tuplet: { actual: 3, normal: 2 } },
      ...extra,
    });
    expectClean(guitarWith(triplet(), triplet(), triplet(), beat(2, open())));
    expectClean(
      guitarWith({ ...beat(2, open()), duration: { value: 2, dots: 1 } }, beat(4, open())),
    );
    expectClean(guitarWith(beat(8, open(), { grace: 'beforeBeat' }), beat(1, open())));
    const sevenEighths = { ...beat(2, open()), duration: { value: 2 as const, dots: 2 as const } };
    expectClean(guitarWith(sevenEighths, beat(8, open())));
  });

  it('reports an overfull voice as an error', () => {
    expectIssue(guitarWith(beat(1, open()), beat(4, open())), ISSUE_CODES.voiceOverfull, VOICE_0);
  });

  it('reports an incomplete voice as a warning', () => {
    expectIssue(guitarWith(beat(2, open())), ISSUE_CODES.voiceIncomplete, VOICE_0, 'warning');
  });

  it('warns for an empty primary voice but not for an empty secondary voice', () => {
    const doc = guitarWith(beat(1, open()));
    const firstBar = doc.tracks[0]?.staves[0]?.bars[0];
    firstBar?.voices.push({ id: testId(), beats: [] });
    expectClean(doc);
    if (firstBar?.voices[0]) firstBar.voices[0].beats = [];
    expectIssue(doc, ISSUE_CODES.voiceIncomplete, VOICE_0, 'warning');
  });

  it('allows a short pickup bar and uses the current time signature', () => {
    const doc = guitarWith(beat(4, open()));
    const first = doc.masterBars[0];
    if (first) first.isAnacrusis = true;
    expectClean(doc);

    const waltz = documentWith(
      [
        track('guitar', [
          guitarStaff([
            bar([beat(1, open())]),
            bar([{ ...beat(2, open()), duration: { value: 2, dots: 1 } }]),
          ]),
        ]),
      ],
      2,
    );
    const second = waltz.masterBars[1];
    if (second) second.timeSignature = { numerator: 3, denominator: 4 };
    expectClean(waltz);
  });
});

describe('invariant 4: strings and frets', () => {
  const guitarNotes = (...notes: ReturnType<typeof note>[]) =>
    documentWith([track('guitar', [guitarStaff([bar([beat(1, notes)])])])]);

  it('accepts a chord on different strings', () => {
    expectClean(
      guitarNotes(
        note({ string: 1, fret: 0 }),
        note({ string: 2, fret: 1 }),
        note({ string: 6, fret: 24 }),
      ),
    );
  });

  it('reports a string beyond the tuning', () => {
    expectIssue(guitarNotes(note({ string: 7, fret: 0 })), ISSUE_CODES.stringOutOfRange, [
      ...NOTE_0,
      'string',
    ]);
  });

  it('reports a fret beyond fretCount', () => {
    expectIssue(guitarNotes(note({ string: 1, fret: 25 })), ISSUE_CODES.fretOutOfRange, [
      ...NOTE_0,
      'fret',
    ]);
  });

  it('reports two notes on one string in a beat', () => {
    const doc = guitarNotes(note({ string: 3, fret: 0 }), note({ string: 3, fret: 2 }));
    expectIssue(doc, ISSUE_CODES.duplicateStringInBeat, [
      'tracks',
      0,
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
      'string',
    ]);
  });

  it('reports a capo beyond fretCount', () => {
    const doc = guitarNotes(note({ string: 1, fret: 0 }));
    const stringed = doc.tracks[0]?.staves[0]?.stringed;
    if (stringed) stringed.capo = 25;
    expectIssue(doc, ISSUE_CODES.capoOutOfRange, ['tracks', 0, 'staves', 0, 'stringed', 'capo']);
  });

  it('requires exactly one pitch authority', () => {
    expectIssue(
      guitarNotes(note({ string: 1, fret: 0, pitch: 64 })),
      ISSUE_CODES.notePitchConflict,
      [...NOTE_0, 'pitch'],
    );
    expectIssue(guitarNotes(note({ string: 1 })), ISSUE_CODES.notePitchMissing, NOTE_0);
    const pianoDoc = documentWith([
      piano([[[beat(1, [note({ pitch: 60, string: 1, fret: 0 })])]]]),
    ]);
    expectIssue(pianoDoc, ISSUE_CODES.notePitchConflict, NOTE_0);
    const noPitch = documentWith([piano([[[beat(1, [note({})])]]])]);
    expectIssue(noPitch, ISSUE_CODES.notePitchMissing, [...NOTE_0, 'pitch']);
  });
});

describe('invariant 5: a rest has no notes', () => {
  it('accepts an empty rest', () =>
    expectClean(documentWith([track('guitar', [guitarStaff([bar([rest()])])])])));

  it('reports a rest with notes', () => {
    const doc = documentWith([
      track('guitar', [
        guitarStaff([bar([beat(1, [note({ string: 1, fret: 0 })], { rest: true })])]),
      ]),
    ]);
    expectIssue(doc, ISSUE_CODES.restWithNotes, [
      'tracks',
      0,
      'staves',
      0,
      'bars',
      0,
      'voices',
      0,
      'beats',
      0,
      'notes',
    ]);
  });
});

describe('invariant 6: a tie needs the same pitch in the previous beat of the voice', () => {
  const TIE_BAR_1 = [
    'tracks',
    0,
    'staves',
    0,
    'bars',
    1,
    'voices',
    0,
    'beats',
    0,
    'notes',
    0,
    'tiedFromPrevious',
  ];
  const pianoTie = (firstPitch: number, tiedPitch: number) =>
    documentWith(
      [
        track('piano', [
          pitchStaff(
            [
              bar([beat(1, [note({ pitch: firstPitch })])]),
              bar([beat(1, [note({ pitch: tiedPitch, tiedFromPrevious: true })])]),
            ],
            { hand: 'right' },
          ),
        ]),
      ],
      2,
    );

  it('accepts a tie across the bar line', () => expectClean(pianoTie(60, 60)));

  it('accepts a tie inside a bar', () => {
    expectClean(
      documentWith([
        piano([
          [
            [
              beat(2, [note({ pitch: 60 })]),
              beat(2, [note({ pitch: 60, tiedFromPrevious: true })]),
            ],
          ],
        ]),
      ]),
    );
  });

  it('reports a tie to a different pitch', () => {
    expectIssue(pianoTie(60, 62), ISSUE_CODES.tieWithoutOrigin, TIE_BAR_1);
  });

  it('reports a tie on the first beat of the piece or after a rest', () => {
    expectIssue(
      documentWith([piano([[[beat(1, [note({ pitch: 60, tiedFromPrevious: true })])]]])]),
      ISSUE_CODES.tieWithoutOrigin,
      [...NOTE_0, 'tiedFromPrevious'],
    );
    const afterRest = documentWith([
      piano([[[rest(2), beat(2, [note({ pitch: 60, tiedFromPrevious: true })])]]]),
    ]);
    expectIssue(afterRest, ISSUE_CODES.tieWithoutOrigin, [
      'tracks',
      0,
      'staves',
      0,
      'bars',
      0,
      'voices',
      0,
      'beats',
      1,
      'notes',
      0,
      'tiedFromPrevious',
    ]);
  });
});

describe('invariant 7: repeats and directions are well-formed', () => {
  it('accepts consecutive repeat sections and complete jump targets', () => {
    expectClean(
      masterBars(minimalDocument(), [
        { repeatStart: true },
        { repeatEnd: { count: 2 } },
        { repeatStart: true, repeatEnd: { count: 3 } },
      ]),
    );
    expectClean(
      masterBars(minimalDocument(), [
        { direction: 'segno' },
        { direction: 'toCoda' },
        { direction: 'dalSegnoAlCoda' },
        { direction: 'coda' },
      ]),
    );
    expectClean(
      masterBars(minimalDocument(), [{}, { direction: 'fine' }, { direction: 'daCapoAlFine' }]),
    );
  });

  it('reports a repeat start inside an open repeat', () => {
    const doc = masterBars(minimalDocument(), [
      { repeatStart: true },
      { repeatStart: true },
      { repeatEnd: { count: 2 } },
    ]);
    expectIssue(doc, ISSUE_CODES.repeatStartNested, ['masterBars', 1, 'repeatStart']);
  });

  it.each([
    ['dalSegno', [{}, { direction: 'dalSegno' as const }]],
    ['daCapoAlCoda', [{ direction: 'coda' as const }, { direction: 'daCapoAlCoda' as const }]],
    ['dalSegnoAlFine', [{ direction: 'segno' as const }, { direction: 'dalSegnoAlFine' as const }]],
    ['toCoda', [{}, { direction: 'toCoda' as const }]],
  ])('reports a missing jump target for %s', (_name, bars) => {
    expectIssue(masterBars(minimalDocument(), bars), ISSUE_CODES.directionTargetMissing, [
      'masterBars',
      1,
      'direction',
    ]);
  });
});

describe('invariant 8: bar 0 defines the initial state, later bars only changes', () => {
  it('accepts real changes later on', () => {
    // 2/2 differs from 4/4 but has the same length, so the whole-rest bars stay complete.
    expectClean(
      masterBars(minimalDocument(), [
        {},
        {
          timeSignature: { numerator: 2, denominator: 2 },
          keySignature: { fifths: 2, mode: 'major' },
        },
      ]),
    );
  });

  it.each([
    ['timeSignature', ISSUE_CODES.firstBarTimeSignatureMissing],
    ['keySignature', ISSUE_CODES.firstBarKeySignatureMissing],
    ['tempoChanges', ISSUE_CODES.firstBarTempoMissing],
  ] as const)('reports a missing %s on bar 0', (key, code) => {
    const doc = minimalDocument();
    const first = doc.masterBars[0];
    if (first) Reflect.deleteProperty(first, key);
    expectIssue(doc, code, ['masterBars', 0, key]);
  });

  it('requires the first tempo at position [0, 1]', () => {
    const doc = minimalDocument();
    const first = doc.masterBars[0];
    if (first) first.tempoChanges = [{ position: [1, 2], bpm: 90 }];
    expectIssue(doc, ISSUE_CODES.firstBarTempoMissing, ['masterBars', 0, 'tempoChanges']);
  });

  it('reports repeated signatures that are not changes', () => {
    const doc = masterBars(minimalDocument(), [
      {},
      {
        timeSignature: { numerator: 4, denominator: 4 },
        keySignature: { fifths: 0, mode: 'major' },
      },
    ]);
    expectIssue(doc, ISSUE_CODES.redundantTimeSignature, ['masterBars', 1, 'timeSignature']);
    expectIssue(doc, ISSUE_CODES.redundantKeySignature, ['masterBars', 1, 'keySignature']);
  });

  it('allows a pickup only on bar 0', () => {
    const doc = masterBars(minimalDocument(), [{}, { isAnacrusis: true }]);
    expectIssue(doc, ISSUE_CODES.anacrusisNotFirstBar, ['masterBars', 1, 'isAnacrusis']);
  });
});

describe('invariant 9: alternate endings match their repeat', () => {
  it('accepts |: A |1. B :|2. C | with count 2, and multi-bar endings', () => {
    expectClean(
      masterBars(minimalDocument(), [
        { repeatStart: true },
        { alternateEndings: [1], repeatEnd: { count: 2 } },
        { alternateEndings: [2] },
      ]),
    );
    expectClean(
      masterBars(minimalDocument(), [
        { repeatStart: true },
        { alternateEndings: [1, 2] },
        { alternateEndings: [1, 2], repeatEnd: { count: 3 } },
        { alternateEndings: [3] },
      ]),
    );
  });

  it('reports an ending number above the repeat count', () => {
    const doc = masterBars(minimalDocument(), [
      { repeatStart: true },
      { alternateEndings: [1], repeatEnd: { count: 2 } },
      { alternateEndings: [3] },
    ]);
    expectIssue(doc, ISSUE_CODES.alternateEndingExceedsCount, [
      'masterBars',
      2,
      'alternateEndings',
    ]);
  });

  it('reports endings without a repeat end', () => {
    const doc = masterBars(minimalDocument(), [{}, { alternateEndings: [1] }]);
    expectIssue(doc, ISSUE_CODES.alternateEndingWithoutRepeat, [
      'masterBars',
      1,
      'alternateEndings',
    ]);
  });

  it('reports duplicate ending numbers and different counts in one group', () => {
    const doc = masterBars(minimalDocument(), [
      { repeatStart: true },
      { alternateEndings: [1, 1], repeatEnd: { count: 3 } },
      { alternateEndings: [2], repeatEnd: { count: 2 } },
    ]);
    expectIssue(doc, ISSUE_CODES.alternateEndingDuplicate, ['masterBars', 1, 'alternateEndings']);
    expectIssue(doc, ISSUE_CODES.alternateEndingCountMismatch, [
      'masterBars',
      2,
      'repeatEnd',
      'count',
    ]);
  });
});

describe('invariant 10: hands and sustain pedal only on keyboard tracks', () => {
  it('accepts a grand staff with hands and pedal', () => {
    const doc = documentWith([
      piano([[[beat(1, [note({ pitch: 72, hand: 'left' })])]], [[beat(1, [note({ pitch: 48 })])]]]),
    ]);
    const lower = doc.tracks[0]?.staves[1]?.bars[0];
    if (lower)
      lower.sustainPedal = [
        { position: [0, 1], type: 'down' },
        { position: [3, 4], type: 'up' },
      ];
    expectClean(doc);
  });

  it('reports hands on a guitar staff and note', () => {
    const doc = documentWith([
      track('guitar', [
        {
          ...guitarStaff([bar([beat(1, [note({ string: 1, fret: 0, hand: 'right' })])])]),
          hand: 'right',
        },
      ]),
    ]);
    expectIssue(doc, ISSUE_CODES.keyboardOnlyHand, ['tracks', 0, 'staves', 0, 'hand']);
    expectIssue(doc, ISSUE_CODES.keyboardOnlyHand, [...NOTE_0, 'hand']);
  });

  it('reports a sustain pedal on a guitar bar', () => {
    const doc = documentWith([
      track('guitar', [
        guitarStaff([bar([rest()], { sustainPedal: [{ position: [0, 1], type: 'down' }] })]),
      ]),
    ]);
    expectIssue(doc, ISSUE_CODES.keyboardOnlyPedal, [
      'tracks',
      0,
      'staves',
      0,
      'bars',
      0,
      'sustainPedal',
    ]);
  });

  it('reports a keyboard track with three staves', () => {
    const doc = documentWith([piano([[[rest()]], [[rest()]], [[rest()]]])]);
    expectIssue(doc, ISSUE_CODES.keyboardStaffCount, ['tracks', 0, 'staves']);
  });
});

describe('invariant 11: tempo and pedal positions strictly increase', () => {
  it('accepts increasing positions and a pedal held across bars and to the end', () => {
    const doc = documentWith([piano([[[rest()], [rest()]]])], 2);
    const first = doc.masterBars[0];
    if (first)
      first.tempoChanges = [
        { position: [0, 1], bpm: 120 },
        { position: [1, 2], bpm: 90, label: 'rit.' },
      ];
    const bars = doc.tracks[0]?.staves[0]?.bars;
    if (bars?.[0] && bars[1]) {
      bars[0].sustainPedal = [{ position: [1, 2], type: 'down' }];
      bars[1].sustainPedal = [
        { position: [1, 4], type: 'up' },
        { position: [1, 2], type: 'down' },
      ];
    }
    expectClean(doc);
  });

  it('reports equal or decreasing tempo positions', () => {
    const doc = minimalDocument();
    const first = doc.masterBars[0];
    if (first) {
      first.tempoChanges = [
        { position: [0, 1], bpm: 120 },
        { position: [1, 2], bpm: 100 },
        { position: [1, 2], bpm: 90 },
        { position: [1, 4], bpm: 80 },
      ];
    }
    expectIssue(doc, ISSUE_CODES.positionsNotIncreasing, [
      'masterBars',
      0,
      'tempoChanges',
      2,
      'position',
    ]);
    expectIssue(doc, ISSUE_CODES.positionsNotIncreasing, [
      'masterBars',
      0,
      'tempoChanges',
      3,
      'position',
    ]);
  });

  it('reports decreasing pedal positions and invalid down/up sequences', () => {
    const doc = documentWith([piano([[[rest()]]])]);
    const pedalBar = doc.tracks[0]?.staves[0]?.bars[0];
    const PEDAL = ['tracks', 0, 'staves', 0, 'bars', 0, 'sustainPedal'];
    if (pedalBar)
      pedalBar.sustainPedal = [
        { position: [1, 2], type: 'down' },
        { position: [1, 4], type: 'up' },
      ];
    expectIssue(doc, ISSUE_CODES.positionsNotIncreasing, [...PEDAL, 1, 'position']);

    if (pedalBar) pedalBar.sustainPedal = [{ position: [0, 1], type: 'up' }];
    expectIssue(doc, ISSUE_CODES.pedalSequenceInvalid, [...PEDAL, 0, 'type']);

    if (pedalBar)
      pedalBar.sustainPedal = [
        { position: [0, 1], type: 'down' },
        { position: [1, 2], type: 'down' },
      ];
    expectIssue(doc, ISSUE_CODES.pedalSequenceInvalid, [...PEDAL, 1, 'type']);
  });
});

describe('invariant 12: ties on stringed staves keep string and fret', () => {
  const TIE = [
    'tracks',
    0,
    'staves',
    0,
    'bars',
    1,
    'voices',
    0,
    'beats',
    0,
    'notes',
    0,
    'tiedFromPrevious',
  ];
  const guitarTie = (
    from: { string: number; fret: number },
    to: { string: number; fret: number },
  ) =>
    documentWith(
      [
        track('guitar', [
          guitarStaff([
            bar([beat(1, [note(from)])]),
            bar([beat(1, [note({ ...to, tiedFromPrevious: true })])]),
          ]),
        ]),
      ],
      2,
    );

  it('accepts a tie across the bar line on the same string and fret', () => {
    expectClean(guitarTie({ string: 1, fret: 5 }, { string: 1, fret: 5 }));
  });

  it('reports a tie to the same pitch on another string', () => {
    // String 1 fret 5 and string 2 fret 10 both sound A4 (69) in standard tuning.
    expectIssue(
      guitarTie({ string: 1, fret: 5 }, { string: 2, fret: 10 }),
      ISSUE_CODES.tieStringFretMismatch,
      TIE,
    );
  });

  it('reports a tie to a different pitch', () => {
    expectIssue(
      guitarTie({ string: 1, fret: 5 }, { string: 1, fret: 7 }),
      ISSUE_CODES.tieWithoutOrigin,
      TIE,
    );
  });
});

describe('invariant 13: percussion notes have no string and fret', () => {
  const drums = (...notes: ReturnType<typeof note>[]) =>
    documentWith([track('drums', [pitchStaff([bar([beat(1, notes)])])], true)]);

  it('accepts General MIDI keys as pitch', () => {
    expectClean(drums(note({ pitch: 36 }), note({ pitch: 42 })));
  });

  it('reports string and fret on a percussion note', () => {
    expectIssue(
      drums(note({ pitch: 36, string: 1, fret: 0 })),
      ISSUE_CODES.percussionNoteWithString,
      NOTE_0,
    );
  });

  it('reports a percussion note without a pitch', () => {
    expectIssue(drums(note({})), ISSUE_CODES.notePitchMissing, [...NOTE_0, 'pitch']);
  });
});
