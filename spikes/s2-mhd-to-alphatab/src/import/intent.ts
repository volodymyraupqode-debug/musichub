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

export interface Intent {
  /** File name in fixtures/import/musicxml without extension. */
  name: string;
  doc: MhdDocument;
  /** Musical content of the fixture that MHD v1 cannot express (checked separately, never in `doc`). */
  notInMhd: string[];
  /** Targeted checks on the imported alphaTab Score for content outside the MHD fact groups. */
  dynamics?: { bar: number; beat: number; value: NonNullable<Beat['dynamic']> }[];
}

export function intents(): Intent[] {
  return [
    {
      name: 'mx01-notes-rests',
      doc: single(
        'mx01-notes-rests',
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
        '01',
      ),
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
  ];
}
