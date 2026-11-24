// Spike S5 golden scenarios: small, original, deterministic MHD v1 documents. In the main track
// every bar plays pitch 60 + bar index, so the playback order can be read from the MIDI keys.
// `expectedOrder` is the bar order derived by hand from the scenario's MHD semantics; the tests
// check it against both the prototype and alphaTab's reference MIDI.
import type { Beat, MasterBar, MhdDocument, Note, Track } from '@musichub/music-model';
import {
  FIRST_BAR,
  bar,
  beat,
  d,
  documentOf,
  idSource,
  rest,
  staff,
  track,
  voice,
} from '../builders.ts';

export interface Scenario {
  name: string;
  description: string;
  doc: MhdDocument;
  /** Expected master-bar playback order; null when MHD v1 does not define it. */
  expectedOrder: number[] | null;
  /** Why the semantics are undefined, or why alphaTab differs, when known. */
  note?: string;
}

type MB = Omit<MasterBar, 'id'>;
const P = (n: number, d0: number): [number, number] => [n, d0];

/** One piano track; bar i plays a whole note of pitch 60 + i, unless `custom` gives beats. */
function simple(
  name: string,
  masterBars: MB[],
  custom: Record<number, (id: () => string) => Beat[]> = {},
  extraTracks: (id: () => string, bars: number) => Track[] = () => [],
): MhdDocument {
  const id = idSource(`T${name.slice(0, 1).toUpperCase()}`);
  const bars = masterBars.map((_, i) =>
    bar(id, [voice(id, custom[i]?.(id) ?? [beat(id, d(1), [{ pitch: 60 + i }])])]),
  );
  const tracks = [
    track(id, 'Piano', { family: 'piano', midiProgram: 0, percussion: false }, [staff(id, bars)]),
    ...extraTracks(id, masterBars.length),
  ];
  return documentOf('01900000-0000-7000-8000-000000000506', `S5 ${name}`, masterBars, tracks, id);
}

const first = (extra: Partial<MB> = {}): MB => ({ ...FIRST_BAR, ...extra });
const quarters = (
  id: () => string,
  pitches: number[],
  extra: (i: number) => Partial<Beat> = () => ({}),
) => pitches.map((p, i) => beat(id, d(4), [{ pitch: p }], extra(i)));

export function scenarios(): Scenario[] {
  return [
    {
      name: 'sequential',
      description: 'Plain playback: 4 bars, two tracks (piano, bass with string/fret).',
      doc: simple('sequential', [first(), {}, {}, {}], {}, (id, n) => [
        track(id, 'Bass', { family: 'bass', midiProgram: 33, percussion: false }, [
          staff(
            id,
            Array.from({ length: n }, (_, i) =>
              bar(id, [
                voice(id, [
                  beat(id, d(2), [{ string: 4, fret: i }]),
                  beat(id, d(2), [{ string: 3, fret: i }]),
                ]),
              ]),
            ),
            {
              display: { standard: false, tab: true, slash: false, numbered: false },
              stringed: { tuning: [43, 38, 33, 28], capo: 0, fretCount: 20 },
              transpositionPitch: -12,
            },
          ),
        ]),
      ]),
      expectedOrder: [0, 1, 2, 3],
    },
    {
      name: 'repeat',
      description: 'Repeat start/end: |: 1 2 :| 3, played twice; then |: 4 :| played three times.',
      doc: simple('repeat', [
        first(),
        { repeatStart: true },
        { repeatEnd: { count: 2 } },
        {},
        { repeatStart: true, repeatEnd: { count: 3 } },
        {},
      ]),
      expectedOrder: [0, 1, 2, 1, 2, 3, 4, 4, 4, 5],
    },
    {
      name: 'repeat-without-start',
      description: 'A repeat end without any repeat start repeats from the beginning: 0 1 :| 2.',
      doc: simple('repeat-without-start', [first(), { repeatEnd: { count: 2 } }, {}]),
      expectedOrder: [0, 1, 0, 1, 2],
    },
    {
      name: 'repeat-end-after-repeat',
      description:
        'Two repeat ends, the second without its own start: |: 1 2 :| 3 4 :|. MHD: the second repeats "from the previous repeat end" (bars 3 4).',
      doc: simple('repeat-end-after-repeat', [
        first(),
        { repeatStart: true },
        { repeatEnd: { count: 2 } },
        {},
        { repeatEnd: { count: 2 } },
        {},
      ]),
      expectedOrder: [0, 1, 2, 1, 2, 3, 4, 3, 4, 5],
      note: 'alphaTab keeps one repeat group from bar 1 and jumps back to bar 1 at the second closing (RepeatGroup / Repeat.onClosing).',
    },
    {
      name: 'volta',
      description: 'Alternate endings: |: 1 |1.2. 2 :|(3x) |3. 3 | 4.',
      doc: simple('volta', [
        first(),
        { repeatStart: true },
        { alternateEndings: [1, 2], repeatEnd: { count: 3 } },
        { alternateEndings: [3] },
        {},
      ]),
      expectedOrder: [0, 1, 2, 1, 2, 1, 3, 4],
    },
    {
      name: 'volta-multibar',
      description: 'Two-bar first ending and one-bar second ending: |: 1 |1. 2 3 :| |2. 4 | 5.',
      doc: simple('volta-multibar', [
        first(),
        { repeatStart: true },
        { alternateEndings: [1] },
        { alternateEndings: [1], repeatEnd: { count: 2 } },
        { alternateEndings: [2] },
        {},
      ]),
      expectedOrder: [0, 1, 2, 3, 1, 4, 5],
    },
    {
      name: 'dal-segno',
      description: 'D.S.: 0 𝄋1 2 3(D.S.) 4 → 0 1 2 3 1 2 3 4.',
      doc: simple('dal-segno', [
        first(),
        { direction: 'segno' },
        {},
        { direction: 'dalSegno' },
        {},
      ]),
      expectedOrder: [0, 1, 2, 3, 1, 2, 3, 4],
    },
    {
      name: 'da-capo-al-fine',
      description: 'D.C. al Fine: 0 1(Fine) 2 3(D.C. al Fine) → 0 1 2 3 0 1.',
      doc: simple('da-capo-al-fine', [
        first(),
        { direction: 'fine' },
        {},
        { direction: 'daCapoAlFine' },
      ]),
      expectedOrder: [0, 1, 2, 3, 0, 1],
    },
    {
      name: 'da-capo',
      description: 'D.C.: 0 1 2(D.C.) 3 → 0 1 2 0 1 2 3.',
      doc: simple('da-capo', [first(), {}, { direction: 'daCapo' }, {}]),
      expectedOrder: [0, 1, 2, 0, 1, 2, 3],
    },
    {
      name: 'coda',
      description: 'D.S. al Coda: 0 𝄋1 2(To Coda) 3(D.S. al Coda) 𝄌4 5 → 0 1 2 3 1 2 4 5.',
      doc: simple('coda', [
        first(),
        { direction: 'segno' },
        { direction: 'toCoda' },
        { direction: 'dalSegnoAlCoda' },
        { direction: 'coda' },
        {},
      ]),
      expectedOrder: [0, 1, 2, 3, 1, 2, 4, 5],
    },
    {
      name: 'da-capo-al-coda',
      description: 'D.C. al Coda: 0 1(To Coda) 2(D.C. al Coda) 𝄌3 → 0 1 2 0 1 3.',
      doc: simple('da-capo-al-coda', [
        first(),
        { direction: 'toCoda' },
        { direction: 'daCapoAlCoda' },
        { direction: 'coda' },
      ]),
      expectedOrder: [0, 1, 2, 0, 1, 3],
    },
    {
      name: 'segno-with-repeat',
      description:
        'D.S. back into a repeat: 0 𝄋|: 1 2 :| 3(D.S. al Fine, Fine at 2). After the jump the repeat plays its final pass only.',
      doc: simple('segno-with-repeat', [
        first(),
        { direction: 'segno', repeatStart: true },
        { repeatEnd: { count: 2 }, direction: 'fine' },
        { direction: 'dalSegnoAlFine' },
      ]),
      expectedOrder: [0, 1, 2, 1, 2, 3, 1, 2],
      note: 'Repeats after a jump are not defined by MHD; the convention used (final pass only) matches alphaTab.',
    },
    {
      name: 'jump-inside-repeat',
      description:
        'A D.C. on the closing bar of a repeat is taken after the last pass: |: 1 2(:|, D.C.) 3.',
      doc: simple('jump-inside-repeat', [
        first(),
        { repeatStart: true },
        { repeatEnd: { count: 2 }, direction: 'daCapo' },
        {},
      ]),
      expectedOrder: [0, 1, 2, 1, 2, 0, 1, 2, 3],
      note: 'When a jump inside a repeat is taken is not defined by MHD; the convention used (last pass) matches alphaTab.',
    },
    {
      name: 'segno-segno-double-coda',
      description:
        'segnoSegno and doubleCoda markers: no MHD v1 direction jumps to them, so they play in order.',
      doc: simple('segno-segno-double-coda', [
        first(),
        { direction: 'segnoSegno' },
        {},
        { direction: 'doubleCoda' },
        {},
      ]),
      expectedOrder: [0, 1, 2, 3, 4],
      note: 'alphaTab can jump to them (D.S.S., al Double Coda), but MHD v1 has no such directions.',
    },
    {
      name: 'ties',
      description:
        'Ties within a bar, across a bar line, chord ties, and a tie into a repeated bar.',
      doc: simple('ties', [first(), { repeatStart: true }, { repeatEnd: { count: 2 } }, {}], {
        0: (id) => [
          beat(id, d(2), [{ pitch: 60 }]),
          beat(id, d(4), [{ pitch: 60, tiedFromPrevious: true }]),
          beat(id, d(4), [{ pitch: 64 }, { pitch: 67 }]),
        ],
        1: (id) => [
          beat(id, d(2), [
            { pitch: 64, tiedFromPrevious: true },
            { pitch: 67, tiedFromPrevious: true },
          ]),
          beat(id, d(2), [{ pitch: 62 }]),
        ],
        2: (id) => [beat(id, d(1), [{ pitch: 62, tiedFromPrevious: true }])],
        3: (id) => [beat(id, d(1), [{ pitch: 72 }])],
      }),
      expectedOrder: [0, 1, 2, 1, 2, 3],
    },
    {
      name: 'grace',
      description:
        'Grace notes: before-beat at the very start (tick shift), groups of 1, 2 and 3, on-beat, and a before-beat grace on the first bar of a repeat.',
      doc: simple('grace', [first(), { repeatStart: true }, { repeatEnd: { count: 2 } }, {}], {
        0: (id) => [
          beat(id, d(16), [{ pitch: 59 }], { grace: 'beforeBeat' }),
          ...quarters(id, [60, 62, 64, 65]),
        ],
        1: (id) => [
          beat(id, d(16), [{ pitch: 66 }], { grace: 'beforeBeat' }),
          beat(id, d(16), [{ pitch: 67 }], { grace: 'beforeBeat' }),
          beat(id, d(2), [{ pitch: 69 }]),
          beat(id, d(16), [{ pitch: 71 }], { grace: 'onBeat' }),
          beat(id, d(2), [{ pitch: 72 }]),
        ],
        2: (id) => [
          beat(id, d(32), [{ pitch: 70 }], { grace: 'beforeBeat' }),
          beat(id, d(32), [{ pitch: 71 }], { grace: 'beforeBeat' }),
          beat(id, d(32), [{ pitch: 73 }], { grace: 'beforeBeat' }),
          beat(id, d(1), [{ pitch: 74 }]),
        ],
        3: (id) => [rest(id, d(1))],
      }),
      expectedOrder: [0, 1, 2, 1, 2, 3],
    },
    {
      name: 'combined',
      description:
        'Pickup, repeat with endings, tempo change, tie, grace, D.S. al Coda, fermata and ottava, with a drum track.',
      doc: simple(
        'combined',
        [
          first({ isAnacrusis: true }),
          { repeatStart: true, direction: 'segno' },
          {
            alternateEndings: [1],
            repeatEnd: { count: 2 },
            tempoChanges: [{ position: P(1, 2), bpm: 100 }],
          },
          { alternateEndings: [2], direction: 'toCoda' },
          { direction: 'dalSegnoAlCoda', fermatas: [{ position: P(0, 1) }] },
          { direction: 'coda' },
        ],
        {
          0: (id) => [beat(id, d(4), [{ pitch: 55 }])],
          1: (id) => [
            beat(id, d(2), [{ pitch: 61 }]),
            beat(id, d(16), [{ pitch: 63 }], { grace: 'beforeBeat' }),
            beat(id, d(2), [{ pitch: 64 }]),
          ],
          2: (id) => [beat(id, d(1), [{ pitch: 64, tiedFromPrevious: true }])],
        },
        (id, n) => [
          track(
            id,
            'Drums',
            { family: 'drums', midiProgram: 0, percussion: true },
            [
              staff(
                id,
                Array.from({ length: n }, (_, i) =>
                  bar(id, [
                    voice(
                      id,
                      i === 0 ? [beat(id, d(4), [{ pitch: 36 }])] : quarters(id, [36, 42, 38, 42]),
                    ),
                  ]),
                ),
              ),
            ],
            { color: 'track.2' },
          ),
        ],
      ),
      expectedOrder: [0, 1, 2, 1, 3, 4, 1, 3, 5],
    },
    {
      name: 'fermata-ottava',
      description:
        'A fermata and an 8va bar: neither changes the MIDI (alphaTab ignores fermatas in playback; ottava is display-only).',
      doc: (() => {
        const doc = simple('fermata-ottava', [first({ fermatas: [{ position: P(1, 2) }] }), {}], {
          0: (id) => quarters(id, [72, 74, 76, 77]),
          1: (id) => quarters(id, [79, 81, 83, 84]),
        });
        const b1 = doc.tracks[0]?.staves[0]?.bars[1];
        if (b1) b1.ottava = '8va';
        return doc;
      })(),
      expectedOrder: [0, 1],
    },
    {
      name: 'ending-closing-skipped',
      description:
        'Endings after the closing bar without their own repeat end: |: 1 |1. 2 :|(3x) |2.3. 3 | 4. On passes 2 and 3 the closing bar 2 is not played.',
      doc: simple('ending-closing-skipped', [
        first(),
        { repeatStart: true },
        { alternateEndings: [1], repeatEnd: { count: 3 } },
        { alternateEndings: [2, 3] },
        {},
      ]),
      expectedOrder: null,
      note: 'Valid MHD, but MHD does not say whether a repeat end that is skipped in a pass still repeats. alphaTab repeats from it (Repeat.onClosing on the last closing).',
    },
  ];
}

export type { Note };
