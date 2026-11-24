// Spike S4 (ROADMAP S2-09): the intended musical content of every hand-authored MusicXML fixture
// (fixtures/import/musicxml), written as MHD from the same specification as the MusicXML file and
// independently of alphaTab. These are the expectations of the import evaluation; they are never
// derived from alphaTab output.
import type { Beat, MasterBar, MhdDocument, Note, Track } from '@musichub/music-model';
import {
  FIRST_BAR,
  GUITAR_TUNING,
  bar,
  beat,
  d,
  documentOf,
  idSource,
  rest,
  staff,
  track,
  voice,
  type Id,
} from '../builders.ts';

/** MIDI pitch of a spelled note (C4 = 60). */
export function midi(
  step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B',
  octave: number,
  alter = 0,
): number {
  const steps = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as const;
  return 12 * (octave + 1) + steps[step] + alter;
}

type MB = Omit<MasterBar, 'id'>;
const piano = { family: 'piano', midiProgram: 0, percussion: false } as const;
const n = (pitch: number, extra: Omit<Note, 'id' | 'pitch'> = {}): Omit<Note, 'id'> => ({
  pitch,
  ...extra,
});

function single(
  name: string,
  masterBars: MB[],
  bars: (id: Id) => Beat[][],
  uuidSuffix: string,
): MhdDocument {
  const id = idSource('S4');
  const t: Track = track(id, 'Piano', piano, [
    staff(
      id,
      bars(id).map((beats) => bar(id, [voice(id, beats)])),
    ),
  ]);
  return documentOf(
    `01900000-0000-7000-8000-0000000004${uuidSuffix}`,
    `MusicHub S4 ${name}`,
    masterBars,
    [t],
    id,
  );
}

/** mx01 content (also the content of the compressed container mx14). */
function notesAndRests(name: string, uuidSuffix: string): MhdDocument {
  return single(
    name,
    [FIRST_BAR, {}, {}, {}],
    (id) => [
      [
        beat(id, d(4), [n(midi('C', 4))]),
        beat(id, d(4), [n(midi('D', 4))]),
        beat(id, d(2), [n(midi('E', 4))]),
      ],
      [
        beat(id, d(8), [n(midi('F', 4))]),
        beat(id, d(8), [n(midi('G', 4))]),
        beat(id, d(4, 1), [n(midi('A', 4))]),
        rest(id, d(4)),
        beat(id, d(16), [n(midi('B', 4))]),
        beat(id, d(16), [n(midi('C', 5))]),
      ],
      [rest(id, d(1))],
      [beat(id, d(1), [n(midi('C', 5))])],
    ],
    uuidSuffix,
  );
}

/** One bar, one track, one staff with an explicit instrument and staff options. */
function oneBar(
  name: string,
  uuidSuffix: string,
  trackName: string,
  instrument: Track['instrument'],
  beats: (id: Id) => Beat[],
  staffExtra: Parameters<typeof staff>[2] = {},
  masterBar: MB = FIRST_BAR,
  barExtra: Parameters<typeof bar>[2] = {},
): MhdDocument {
  const id = idSource('S4');
  const t = track(id, trackName, instrument, [
    staff(id, [bar(id, [voice(id, beats(id))], barExtra)], staffExtra),
  ]);
  return documentOf(
    `01900000-0000-7000-8000-0000000004${uuidSuffix}`,
    `MusicHub S4 ${name}`,
    [masterBar],
    [t],
    id,
  );
}

export interface Intent {
  /** Fixture name; the file is `musicxml/<name>.musicxml` unless `file` says otherwise. */
  name: string;
  /** Path below fixtures/import, for files that are not `.musicxml` (e.g. the compressed `.mxl`). */
  file?: string;
  doc: MhdDocument;
  /** Musical content of the fixture that MHD v1 cannot express (checked separately, never in `doc`). */
  notInMhd: string[];
  /** Targeted checks on the imported alphaTab Score for content outside the MHD fact groups. */
  dynamics?: { bar: number; beat: number; value: NonNullable<Beat['dynamic']> }[];
  /** Fact groups not evaluated for this fixture, with the reason (an open MHD question, never a result). */
  notEvaluated?: Record<string, string>;
}

export function intents(): Intent[] {
  return [
    {
      name: 'mx01-notes-rests',
      doc: notesAndRests('mx01-notes-rests', '01'),
      notInMhd: [],
    },
    {
      name: 'mx02-meter-key',
      doc: single(
        'mx02-meter-key',
        [
          { ...FIRST_BAR, keySignature: { fifths: 1, mode: 'major' } },
          {
            timeSignature: { numerator: 3, denominator: 4 },
            keySignature: { fifths: -1, mode: 'major' },
          },
          {
            timeSignature: { numerator: 6, denominator: 8 },
            keySignature: { fifths: 0, mode: 'minor' },
          },
          {},
        ],
        (id) => [
          [
            beat(id, d(4), [n(midi('G', 4))]),
            beat(id, d(4), [n(midi('F', 4, 1))]),
            beat(id, d(4), [n(midi('E', 4))]),
            beat(id, d(4), [n(midi('D', 4))]),
          ],
          [
            beat(id, d(4), [n(midi('F', 4))]),
            beat(id, d(4), [n(midi('B', 4, -1))]),
            beat(id, d(4), [n(midi('A', 4))]),
          ],
          [
            beat(id, d(4, 1), [n(midi('A', 4))]),
            beat(id, d(8), [n(midi('C', 5))]),
            beat(id, d(8), [n(midi('E', 5))]),
            beat(id, d(8), [n(midi('G', 4, 1))]),
          ],
          [beat(id, d(2, 1), [n(midi('A', 4))])],
        ],
        '02',
      ),
      notInMhd: [],
    },
    {
      name: 'mx03-ties-tuplets',
      doc: single(
        'mx03-ties-tuplets',
        [FIRST_BAR, {}, {}, {}],
        (id) => [
          [beat(id, d(2), [n(midi('C', 4))]), beat(id, d(2), [n(midi('E', 4))])],
          [
            beat(id, d(4), [n(midi('E', 4), { tiedFromPrevious: true })]),
            beat(id, d(8, 0, [3, 2]), [n(midi('G', 4))]),
            beat(id, d(8, 0, [3, 2]), [n(midi('A', 4))]),
            beat(id, d(8, 0, [3, 2]), [n(midi('B', 4))]),
            beat(id, d(2), [n(midi('C', 5))]),
          ],
          [
            beat(id, d(4), [n(midi('D', 5))]),
            beat(id, d(4), [n(midi('D', 5), { tiedFromPrevious: true })]),
            beat(id, d(4, 0, [3, 2]), [n(midi('E', 5))]),
            beat(id, d(4, 0, [3, 2]), [n(midi('F', 5))]),
            beat(id, d(4, 0, [3, 2]), [n(midi('G', 5))]),
          ],
          [beat(id, d(1), [n(midi('C', 5))])],
        ],
        '03',
      ),
      notInMhd: [],
    },
    {
      name: 'mx04-voices-staves',
      doc: (() => {
        const id = idSource('S4');
        const upper = staff(id, [
          bar(id, [
            voice(id, [beat(id, d(2), [n(midi('E', 5))]), beat(id, d(2), [n(midi('D', 5))])]),
            voice(id, [
              beat(id, d(4), [n(midi('C', 5))]),
              beat(id, d(4), [n(midi('B', 4))]),
              beat(id, d(2), [n(midi('A', 4))]),
            ]),
          ]),
          bar(id, [voice(id, [beat(id, d(1), [n(midi('C', 5))])])]),
        ]);
        const lower = staff(id, [
          bar(id, [voice(id, [beat(id, d(1), [n(midi('C', 3))])])], { clef: 'F4' }),
          bar(id, [
            voice(id, [beat(id, d(2), [n(midi('C', 3))]), beat(id, d(2), [n(midi('G', 2))])]),
          ]),
        ]);
        return documentOf(
          '01900000-0000-7000-8000-000000000404',
          'MusicHub S4 mx04-voices-staves',
          [FIRST_BAR, {}],
          [track(id, 'Piano', piano, [upper, lower])],
          id,
        );
      })(),
      notInMhd: [],
    },
    {
      name: 'mx05-tempo-dynamics',
      doc: single(
        'mx05-tempo-dynamics',
        [
          { ...FIRST_BAR, tempoChanges: [{ position: [0, 1], bpm: 90 }] },
          { tempoChanges: [{ position: [1, 2], bpm: 120 }] },
          {},
        ],
        (id) => [
          [
            beat(id, d(4), [n(midi('C', 4))], { dynamic: 'p' }),
            beat(id, d(4), [n(midi('D', 4))]),
            beat(id, d(4), [n(midi('E', 4))]),
            beat(id, d(4), [n(midi('F', 4))]),
          ],
          [beat(id, d(2), [n(midi('G', 4))]), beat(id, d(2), [n(midi('A', 4))], { dynamic: 'mf' })],
          [beat(id, d(1), [n(midi('B', 4))], { dynamic: 'ff' })],
        ],
        '05',
      ),
      notInMhd: [],
      dynamics: [
        { bar: 0, beat: 0, value: 'p' },
        { bar: 1, beat: 1, value: 'mf' },
        { bar: 2, beat: 0, value: 'ff' },
      ],
    },
    {
      name: 'mx06-articulations',
      doc: single(
        'mx06-articulations',
        [FIRST_BAR, { fermatas: [{ position: [0, 1] }] }],
        (id) => [
          [
            beat(id, d(4), [n(midi('C', 5), { effects: { staccato: true } })]),
            beat(id, d(4), [n(midi('D', 5), { effects: { accent: 'normal' } })]),
            beat(id, d(4), [n(midi('E', 5), { effects: { accent: 'heavy' } })]),
            beat(id, d(4), [n(midi('F', 5))]),
          ],
          [beat(id, d(1), [n(midi('G', 5))])],
        ],
        '06',
      ),
      // MHD v1 has no tenuto (NoteEffects): the tenuto on F5 is content MHD cannot hold.
      notInMhd: ['tenuto (bar 1, beat 4)'],
    },
    {
      name: 'mx07-repeats-navigation',
      doc: single(
        'mx07-repeats-navigation',
        [
          { ...FIRST_BAR, repeatStart: true },
          { alternateEndings: [1], repeatEnd: { count: 2 } },
          { alternateEndings: [2] },
          { direction: 'segno' },
          { direction: 'toCoda' },
          { direction: 'dalSegnoAlCoda' },
          { direction: 'coda' },
        ],
        (id) =>
          [
            midi('C', 4),
            midi('D', 4),
            midi('E', 4),
            midi('F', 4),
            midi('G', 4),
            midi('A', 4),
            midi('B', 4),
          ].map((p) => [beat(id, d(1), [n(p)])]),
        '07',
      ),
      notInMhd: [],
    },
    {
      name: 'mx08-guitar-tab',
      doc: (() => {
        const id = idSource('S4');
        const s = (string: number, fret: number): Omit<Note, 'id'> => ({ string, fret });
        const guitar = staff(
          id,
          [
            bar(id, [
              voice(id, [
                beat(id, d(4), [s(6, 3)]),
                beat(id, d(4), [s(5, 3)]),
                beat(id, d(4), [s(4, 2)]),
                beat(id, d(4), [s(3, 0)]),
              ]),
            ]),
            bar(id, [voice(id, [beat(id, d(1), [s(5, 3), s(4, 2), s(3, 0), s(2, 1), s(1, 0)])])]),
          ],
          {
            display: { standard: false, tab: true, slash: false, numbered: false },
            stringed: { tuning: [...GUITAR_TUNING], capo: 0, fretCount: 24 },
          },
        );
        return documentOf(
          '01900000-0000-7000-8000-000000000408',
          'MusicHub S4 mx08-guitar-tab',
          [FIRST_BAR, {}],
          [
            track(id, 'Acoustic Guitar', { family: 'guitar', midiProgram: 25, percussion: false }, [
              guitar,
            ]),
          ],
          id,
        );
      })(),
      notInMhd: [],
    },
    {
      name: 'mx09-multiple-parts',
      doc: (() => {
        const id = idSource('S4');
        const flute = track(
          id,
          'Flute',
          { family: 'woodwinds', midiProgram: 73, percussion: false },
          [staff(id, [bar(id, [voice(id, [beat(id, d(1), [n(midi('C', 5))])])])])],
        );
        const cello = track(
          id,
          'Cello',
          { family: 'strings', midiProgram: 42, percussion: false },
          [staff(id, [bar(id, [voice(id, [beat(id, d(1), [n(midi('C', 3))])])], { clef: 'F4' })])],
        );
        return documentOf(
          '01900000-0000-7000-8000-000000000409',
          'MusicHub S4 mx09-multiple-parts',
          [FIRST_BAR],
          [flute, cello],
          id,
        );
      })(),
      notInMhd: [],
    },
    {
      name: 'mx10-grace-notes',
      // Timing intent from the MusicXML attributes: steal-time-previous → before the beat,
      // steal-time-following → on the beat (slash or not).
      doc: oneBar('mx10-grace-notes', '10', 'Piano', piano, (id) => [
        beat(id, d(8), [n(midi('D', 5))], { grace: 'beforeBeat' }),
        beat(id, d(4), [n(midi('C', 5))]),
        beat(id, d(8), [n(midi('E', 5))], { grace: 'onBeat' }),
        beat(id, d(4), [n(midi('D', 5))]),
        beat(id, d(8), [n(midi('F', 5))], { grace: 'beforeBeat' }),
        beat(id, d(2), [n(midi('E', 5))]),
      ]),
      notInMhd: [],
    },
    {
      name: 'mx11-percussion',
      doc: oneBar(
        'mx11-percussion',
        '11',
        'Drums',
        { family: 'drums', midiProgram: 0, percussion: true },
        (id) => [
          beat(id, d(4), [n(36), n(42)]),
          beat(id, d(4), [n(38)]),
          beat(id, d(4), [n(36), n(42)]),
          beat(id, d(4), [n(38)]),
        ],
      ),
      notInMhd: [],
    },
    {
      name: 'mx12-transposing',
      // Written D5 E5 F#5 with transpose -2: MHD stores the sounding pitch and the written-to-sounding offset.
      doc: oneBar(
        'mx12-transposing',
        '12',
        'Clarinet in Bb',
        { family: 'woodwinds', midiProgram: 71, percussion: false },
        (id) => [
          beat(id, d(4), [n(midi('C', 5))]),
          beat(id, d(4), [n(midi('D', 5))]),
          beat(id, d(2), [n(midi('E', 5))]),
        ],
        { transpositionPitch: -2 },
        { ...FIRST_BAR, keySignature: { fifths: 2, mode: 'major' } },
      ),
      notInMhd: [],
      notEvaluated: {
        keySignature:
          'MHD v1 does not define whether MasterBar.keySignature is the written or the concert key of a transposing staff (written D major = concert C major)',
      },
    },
    {
      name: 'mx13-lyrics-slur',
      doc: oneBar(
        'mx13-lyrics-slur',
        '13',
        'Voice',
        { family: 'vocals', midiProgram: 52, percussion: false },
        (id) => [
          beat(id, d(4), [n(midi('C', 4))], { lyrics: ['la'] }),
          beat(id, d(4), [n(midi('D', 4))], { lyrics: ['li'] }),
          beat(id, d(2), [n(midi('E', 4))], { lyrics: ['lo'] }),
        ],
      ),
      // MHD v1 has no slur.
      notInMhd: ['slur (beats 2–3)'],
    },
    {
      name: 'mx14-compressed',
      file: 'musicxml/mx14-compressed.mxl',
      // Same content as mx01 in a compressed .mxl container.
      doc: notesAndRests('mx14-compressed', '14'),
      notInMhd: [],
    },
  ];
}

export const fixtureFile = (intent: Intent): string =>
  intent.file ?? `musicxml/${intent.name}.musicxml`;
