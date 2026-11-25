// Synthetic MHD v1 documents for constructs the canonical fixtures do not cover (spike S2).
// Original content, valid MHD v1 (checked by synthetic.test.ts with validateDocument).
import type { MhdDocument, Note } from '@musichub/music-model';
import {
  FIRST_BAR,
  GUITAR_TUNING,
  bar,
  beat,
  d,
  documentOf,
  idSource,
  quarters,
  rest,
  staff,
  track,
  voice,
} from './builders.ts';

const uuid = (n: number): string => `01900000-0000-7000-8000-${String(n).padStart(12, '0')}`;

const piano = { family: 'piano', midiProgram: 0, percussion: false } as const;
const guitar = { family: 'guitar', midiProgram: 25, percussion: false } as const;
const tab = { standard: true, tab: true, slash: false, numbered: false };

/** S-voices: four voices in one bar, changing voice counts, an empty secondary voice. */
function multiVoice(): MhdDocument {
  const id = idSource('SV');
  const rh = staff(
    id,
    [
      bar(
        id,
        [
          voice(id, quarters(id, [76, 77, 79, 81])),
          voice(id, [beat(id, d(2), [{ pitch: 72 }]), beat(id, d(2), [{ pitch: 71 }])]),
          voice(id, [beat(id, d(1), [{ pitch: 67 }, { pitch: 64 }])]),
          voice(id, [
            rest(id, d(2)),
            beat(id, d(8), [{ pitch: 60 }]),
            beat(id, d(8), [{ pitch: 62 }]),
            beat(id, d(4), [{ pitch: 64 }]),
          ]),
        ],
        { clef: 'G2' },
      ),
      bar(id, [voice(id, quarters(id, [79, null, 77, 76]))]),
      bar(id, [voice(id, [beat(id, d(1), [{ pitch: 72 }])]), voice(id, [])]),
    ],
    { hand: 'right' },
  );
  const lh = staff(
    id,
    [
      bar(
        id,
        [voice(id, [beat(id, d(1), [{ pitch: 48 }])]), voice(id, quarters(id, [55, 57, 59, 60]))],
        { clef: 'F4' },
      ),
      bar(id, [voice(id, [beat(id, d(2), [{ pitch: 43 }]), beat(id, d(2), [{ pitch: 47 }])])]),
      bar(id, [voice(id, [beat(id, d(1), [{ pitch: 36 }, { pitch: 43 }])])]),
    ],
    { hand: 'left' },
  );
  return documentOf(
    uuid(201),
    'Synthetic — multiple voices',
    [FIRST_BAR, {}, {}],
    [track(id, 'Piano', piano, [rh, lh])],
    id,
  );
}

/** S-instruments: nine tracks with different families, programs, banks, mixer states and tunings. */
function multiInstrument(): MhdDocument {
  const id = idSource('SI');
  const two = (pitches: number[]) => [
    bar(id, [voice(id, quarters(id, pitches))]),
    bar(id, [voice(id, [beat(id, d(1), [{ pitch: pitches[0] ?? 60 }])])]),
  ];
  const tracks = [
    track(id, 'Piano', piano, [
      staff(id, two([72, 74, 76, 77]), { hand: 'right' }),
      staff(
        id,
        [
          bar(id, [voice(id, quarters(id, [48, 50, 52, 53]))], { clef: 'F4' }),
          bar(id, [voice(id, [beat(id, d(1), [{ pitch: 48 }])])]),
        ],
        { hand: 'left' },
      ),
    ]),
    track(
      id,
      'Seven-string guitar',
      { family: 'guitar', midiProgram: 27, percussion: false },
      [
        staff(
          id,
          [
            bar(id, [
              voice(id, [
                beat(id, d(2), [
                  { string: 7, fret: 0 },
                  { string: 4, fret: 2 },
                ]),
                beat(id, d(2), [{ string: 1, fret: 3 }]),
              ]),
            ]),
            bar(id, [voice(id, [beat(id, d(1), [{ string: 6, fret: 5 }])])]),
          ],
          {
            display: tab,
            stringed: { tuning: [64, 59, 55, 50, 45, 40, 35], capo: 0, fretCount: 24 },
            transpositionPitch: -12,
          },
        ),
      ],
      { color: 'track.3', mixer: { volume: 0.5, pan: -1, mute: false, solo: true } },
    ),
    track(
      id,
      'Five-string bass',
      { family: 'bass', midiProgram: 34, percussion: false },
      [
        staff(
          id,
          [
            bar(id, [
              voice(id, [
                beat(id, d(2), [{ string: 5, fret: 0 }]),
                beat(id, d(2), [{ string: 4, fret: 2 }]),
              ]),
            ]),
            bar(id, [voice(id, [beat(id, d(1), [{ string: 1, fret: 5 }])])]),
          ],
          {
            display: { standard: false, tab: true, slash: false, numbered: false },
            stringed: { tuning: [43, 38, 33, 28, 23], capo: 0, fretCount: 24 },
            transpositionPitch: -12,
          },
        ),
      ],
      { color: 'track.4', mixer: { volume: 1, pan: 0.5, mute: true, solo: false } },
    ),
    track(
      id,
      'Violin',
      { family: 'strings', midiProgram: 40, percussion: false },
      [staff(id, two([76, 79, 81, 84]))],
      { color: 'track.5' },
    ),
    track(
      id,
      'Trumpet in B♭',
      { family: 'brass', midiProgram: 56, bank: 1, percussion: false },
      [staff(id, two([70, 72, 74, 75]), { transpositionPitch: -2 })],
      { color: 'track.6' },
    ),
    track(
      id,
      'Flute',
      { family: 'woodwinds', midiProgram: 73, percussion: false },
      [
        staff(id, two([84, 86, 88, 89]), {
          display: { standard: true, tab: false, slash: false, numbered: true },
        }),
      ],
      { color: 'track.7' },
    ),
    track(
      id,
      'Voice',
      { family: 'vocals', midiProgram: 52, percussion: false },
      [
        staff(id, [
          bar(id, [
            voice(id, [
              beat(id, d(2), [{ pitch: 67 }], { lyrics: ['la', 'lu'] }),
              beat(id, d(2), [{ pitch: 69 }], { lyrics: ['li'] }),
            ]),
          ]),
          bar(id, [voice(id, [beat(id, d(1), [{ pitch: 71 }], { text: 'ad lib.' })])]),
        ]),
      ],
      { color: 'track.8', shortName: 'Vox' },
    ),
    track(
      id,
      'Pad',
      { family: 'synth', midiProgram: 89, bank: 128, percussion: false },
      [
        staff(id, two([60, 64, 67, 72]), {
          display: { standard: false, tab: false, slash: true, numbered: false },
        }),
      ],
      { color: 'track.9' },
    ),
    track(
      id,
      'Drums',
      { family: 'drums', midiProgram: 0, percussion: true },
      [
        staff(id, [
          bar(id, [
            voice(id, [
              beat(id, d(4), [{ pitch: 36 }, { pitch: 42 }]),
              beat(id, d(4), [{ pitch: 38 }, { pitch: 42 }]),
              beat(id, d(4), [{ pitch: 36 }, { pitch: 42 }]),
              beat(id, d(4), [{ pitch: 38 }, { pitch: 46 }]),
            ]),
          ]),
          bar(id, [voice(id, [beat(id, d(1), [{ pitch: 49 }, { pitch: 36 }])])]),
        ]),
      ],
      { color: 'track.10' },
    ),
  ];
  return documentOf(uuid(202), 'Synthetic — instruments and mixer', [FIRST_BAR, {}], tracks, id);
}

/** S-rhythm: odd meters, pickup, tuplets (3:2, 5:4, 7:8, 2:3), double dots, 128ths, tempo changes, triplet feel. */
function rhythm(): MhdDocument {
  const id = idSource('SR');
  const p = (v: 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128, dots: 0 | 1 | 2 = 0, t?: [number, number]) =>
    beat(id, d(v, dots, t), [{ pitch: 67 }]);
  const masterBars = [
    { ...FIRST_BAR, isAnacrusis: true as const },
    {
      tempoChanges: [
        { position: [1, 3] as [number, number], bpm: 96, label: 'meno mosso' },
        { position: [3, 4] as [number, number], bpm: 104 },
      ],
    },
    { timeSignature: { numerator: 7, denominator: 8 as const } },
    { timeSignature: { numerator: 5, denominator: 4 as const } },
    { timeSignature: { numerator: 12, denominator: 8 as const }, tripletFeel: '8th' as const },
    { timeSignature: { numerator: 6, denominator: 8 as const }, tripletFeel: 'none' as const },
    { timeSignature: { numerator: 4, denominator: 4 as const } },
  ];
  const bars = [
    [p(8), p(8)], // pickup: 1 quarter
    [p(4, 2), p(16), p(8, 0, [3, 2]), p(8, 0, [3, 2]), p(8, 0, [3, 2]), p(4)], // 7/4+1/16 ... = 4/4
    [p(8), p(8), p(8), p(4, 1), p(8)], // 7/8
    [...Array.from({ length: 5 }, () => p(16, 0, [5, 4])), p(4), p(2), p(4)], // 5/4
    [p(4, 1), p(4, 1), p(8), p(8), p(8), p(4, 1)], // 12/8
    [p(4, 0, [2, 3]), p(4, 0, [2, 3])], // duplet: two quarters in the time of three (6/8)
    // 7:8 sixteenths (1/2) + 8 × 1/128 (1/16) + 1/4 + 1/8 + 1/16 = 1
    [
      ...Array.from({ length: 7 }, () => p(16, 0, [7, 8])),
      ...Array.from({ length: 8 }, () => p(128)),
      p(4),
      p(8),
      p(16),
    ],
  ];
  const s = staff(
    id,
    bars.map((beats) => bar(id, [voice(id, beats)])),
  );
  return documentOf(
    uuid(203),
    'Synthetic — rhythm and meter',
    masterBars,
    [track(id, 'Melody', { family: 'woodwinds', midiProgram: 71, percussion: false }, [s])],
    id,
  );
}

/** S-ties-grace: ties across bars and inside bars (single notes and chords), grace groups of 1–3, on-beat grace. */
function tiesGrace(): MhdDocument {
  const id = idSource('ST');
  const g = (n: Omit<Note, 'id'>[], kind: 'beforeBeat' | 'onBeat' = 'beforeBeat') =>
    beat(id, d(16), n, { grace: kind });
  const gtr = staff(
    id,
    [
      bar(id, [
        voice(id, [
          beat(id, d(2), [
            { string: 2, fret: 5 },
            { string: 1, fret: 7 },
          ]),
          beat(id, d(2), [
            { string: 2, fret: 5, tiedFromPrevious: true },
            { string: 1, fret: 7, tiedFromPrevious: true },
          ]),
        ]),
      ]),
      bar(id, [voice(id, [beat(id, d(1), [{ string: 2, fret: 5, tiedFromPrevious: true }])])]),
      bar(id, [
        voice(id, [
          g([{ string: 3, fret: 4 }]),
          beat(id, d(2), [{ string: 3, fret: 5 }]),
          g([{ string: 3, fret: 2 }]),
          g([{ string: 3, fret: 4 }]),
          beat(id, d(2), [{ string: 3, fret: 5 }]),
        ]),
      ]),
      bar(id, [
        voice(id, [
          g([{ string: 1, fret: 0 }]),
          g([{ string: 1, fret: 2 }]),
          g([{ string: 1, fret: 3 }]),
          beat(id, d(2), [{ string: 1, fret: 5 }]),
          g(
            [
              { string: 2, fret: 3 },
              { string: 1, fret: 3 },
            ],
            'onBeat',
          ),
          beat(id, d(2), [
            { string: 2, fret: 5 },
            { string: 1, fret: 5 },
          ]),
        ]),
      ]),
    ],
    {
      display: tab,
      stringed: { tuning: GUITAR_TUNING, capo: 0, fretCount: 22 },
      transpositionPitch: -12,
    },
  );
  const pno = staff(id, [
    bar(id, [
      voice(id, [
        beat(id, d(4), [{ pitch: 60 }]),
        beat(id, d(4), [{ pitch: 60, tiedFromPrevious: true }]),
        beat(id, d(2), [{ pitch: 64 }, { pitch: 67 }]),
      ]),
    ]),
    bar(id, [
      voice(id, [
        beat(id, d(2), [
          { pitch: 64, tiedFromPrevious: true },
          { pitch: 67, tiedFromPrevious: true },
        ]),
        g([{ pitch: 71 }]),
        beat(id, d(2), [{ pitch: 72 }]),
      ]),
    ]),
    bar(id, [voice(id, [beat(id, d(1), [{ pitch: 72, tiedFromPrevious: true }])])]),
    bar(id, [voice(id, [g([{ pitch: 74 }], 'onBeat'), beat(id, d(1), [{ pitch: 72 }])])]),
  ]);
  return documentOf(
    uuid(204),
    'Synthetic — ties and grace notes',
    [FIRST_BAR, {}, {}, {}],
    [track(id, 'Guitar', guitar, [gtr]), track(id, 'Piano', piano, [pno], { color: 'track.2' })],
    id,
  );
}

/**
 * S-repeats: two repeats, a three-pass repeat with endings [1,2] and [3], and endings above 8.
 * Adapted 2026-11-25 to MHD invariant 14 (ADR-0002 A11, A19): the 12-pass repeat originally had a
 * single repeat end on [1–8], so passes 9–11 reached none. Its [9,10] and [11,12] brackets now
 * carry their own repeat ends (count 12), so every pass before the last reaches one. A group with
 * several repeat ends is valid MHD, but its playback order is not defined yet (deferred to the
 * Phase 1 timeline work); this fixture is therefore no playback-order evidence.
 */
function repeats(): MhdDocument {
  const id = idSource('SP');
  const masterBars = [
    { ...FIRST_BAR, repeatStart: true as const, section: { letter: 'A', text: 'Intro' } },
    { alternateEndings: [1, 2], repeatEnd: { count: 3 } },
    { alternateEndings: [3] },
    { repeatStart: true as const, section: { text: 'Groove' } },
    { repeatEnd: { count: 2 } },
    { repeatStart: true as const },
    { alternateEndings: [1, 2, 3, 4, 5, 6, 7, 8], repeatEnd: { count: 12 } },
    { alternateEndings: [9, 10], repeatEnd: { count: 12 } },
    { alternateEndings: [11, 12], repeatEnd: { count: 12 } },
    {},
  ];
  const s = staff(
    id,
    masterBars.map((_, i) => bar(id, [voice(id, [beat(id, d(1), [{ pitch: 60 + i }])])])),
  );
  return documentOf(
    uuid(205),
    'Synthetic — repeats and alternate endings',
    masterBars,
    [track(id, 'Organ', { family: 'piano', midiProgram: 19, percussion: false }, [s])],
    id,
  );
}

/** S-navigation: segno / segnoSegno / coda / doubleCoda / fine targets with D.C. al Fine. */
function navigation(): MhdDocument {
  const id = idSource('SN');
  const masterBars = [
    { ...FIRST_BAR, direction: 'segno' as const },
    { direction: 'segnoSegno' as const },
    { direction: 'toCoda' as const },
    { direction: 'fine' as const },
    { direction: 'dalSegnoAlCoda' as const },
    { direction: 'coda' as const },
    { direction: 'doubleCoda' as const, fermatas: [{ position: [0, 1] as [number, number] }] },
    { direction: 'daCapoAlFine' as const },
  ];
  const s = staff(
    id,
    masterBars.map((_, i) =>
      bar(id, [
        voice(id, [beat(id, d(2), [{ pitch: 62 + i }]), beat(id, d(2), [{ pitch: 64 + i }])]),
      ]),
    ),
  );
  return documentOf(
    uuid(206),
    'Synthetic — navigation marks',
    masterBars,
    [track(id, 'Lead', { family: 'synth', midiProgram: 81, percussion: false }, [s])],
    id,
  );
}

/** S-percussion: every valid (GM key, drumTechnique) pair plus plain keys that need no technique. */
function percussion(): MhdDocument {
  const id = idSource('SD');
  const hit = (pitch: number, drumTechnique?: Note['drumTechnique']) =>
    beat(id, d(8), [drumTechnique ? { pitch, drumTechnique } : { pitch }]);
  const bars = [
    [
      hit(42, 'halfOpen'),
      hit(46, 'halfOpen'),
      hit(42),
      hit(46),
      hit(44),
      hit(38, 'rimshot'),
      hit(40, 'rimshot'),
      hit(37),
    ],
    [
      hit(51, 'edge'),
      hit(59, 'edge'),
      hit(51),
      hit(59),
      hit(53),
      hit(49, 'choke'),
      hit(52, 'choke'),
      hit(55, 'choke'),
    ],
    [
      hit(57, 'choke'),
      hit(49),
      hit(52),
      hit(55),
      hit(57),
      hit(38),
      hit(40),
      beat(id, d(8), [{ pitch: 36 }, { pitch: 42 }, { pitch: 38, drumTechnique: 'rimshot' }]),
    ],
    [hit(41), hit(43), hit(45), hit(47), hit(48), hit(50), hit(81), hit(54)],
  ];
  const s = staff(
    id,
    bars.map((beats) => bar(id, [voice(id, beats)])),
  );
  return documentOf(
    uuid(207),
    'Synthetic — percussion and drum techniques',
    [FIRST_BAR, {}, {}, {}],
    [track(id, 'Drums', { family: 'drums', midiProgram: 0, percussion: true }, [s])],
    id,
  );
}

/** S-pedal: pedal at thirds and mid-beat positions, held through bars without markers, upper staff, synth. */
function pedal(): MhdDocument {
  const id = idSource('SL');
  const whole = (p: number) => voice(id, [beat(id, d(1), [{ pitch: p }])]);
  const rh = staff(
    id,
    [
      bar(id, [whole(72)], {
        sustainPedal: [
          { position: [0, 1], type: 'down' },
          { position: [1, 3], type: 'up' },
          { position: [2, 3], type: 'down' },
        ],
      }),
      bar(id, [whole(74)]),
      bar(id, [whole(76)]),
      bar(id, [whole(77)], { sustainPedal: [{ position: [5, 8], type: 'up' }] }),
    ],
    { hand: 'right' },
  );
  const lh = staff(
    id,
    [
      bar(id, [whole(48)], { clef: 'F4', sustainPedal: [{ position: [1, 8], type: 'down' }] }),
      bar(id, [whole(50)], {
        sustainPedal: [
          { position: [7, 16], type: 'up' },
          { position: [1, 2], type: 'down' },
        ],
      }),
      bar(id, [whole(52)]),
      bar(id, [whole(53)], { sustainPedal: [{ position: [0, 1], type: 'up' }] }),
    ],
    { hand: 'left' },
  );
  const syn = staff(id, [
    bar(id, [whole(60)], { sustainPedal: [{ position: [0, 1], type: 'down' }] }),
    bar(id, [whole(62)], { sustainPedal: [{ position: [3, 4], type: 'up' }] }),
    bar(id, [whole(64)]),
    bar(id, [whole(65)]),
  ]);
  return documentOf(
    uuid(208),
    'Synthetic — sustain pedal',
    [FIRST_BAR, {}, {}, {}],
    [
      track(id, 'Piano', piano, [rh, lh]),
      track(id, 'E-Piano', { family: 'synth', midiProgram: 4, percussion: false }, [syn], {
        color: 'track.2',
      }),
    ],
    id,
  );
}

/** S-long: 64 bars of sixteenths on guitar and eighths on piano. */
function longSequence(): MhdDocument {
  const id = idSource('SQ');
  const bars = 64;
  const gtr = staff(
    id,
    Array.from({ length: bars }, (_, b) =>
      bar(id, [
        voice(
          id,
          Array.from({ length: 16 }, (_, i) =>
            beat(id, d(16), [{ string: (i % 6) + 1, fret: (b + i) % 13 }]),
          ),
        ),
      ]),
    ),
    {
      display: tab,
      stringed: { tuning: GUITAR_TUNING, capo: 0, fretCount: 24 },
      transpositionPitch: -12,
    },
  );
  const pno = staff(
    id,
    Array.from({ length: bars }, (_, b) =>
      bar(id, [
        voice(
          id,
          Array.from({ length: 8 }, (_, i) =>
            beat(id, d(8), [{ pitch: 60 + ((b * 3 + i * 5) % 24) }]),
          ),
        ),
      ]),
    ),
  );
  return documentOf(
    uuid(209),
    'Synthetic — long note sequence',
    [FIRST_BAR, ...Array.from({ length: bars - 1 }, () => ({}))],
    [track(id, 'Guitar', guitar, [gtr]), track(id, 'Piano', piano, [pno], { color: 'track.2' })],
    id,
  );
}

/** S-effects: every note and beat effect, spelling, dynamics, velocity, hand, key/clef/ottava changes. */
function effects(): MhdDocument {
  const id = idSource('SE');
  const n = (string: number, fret: number, effects?: Note['effects']): Omit<Note, 'id'> =>
    effects ? { string, fret, effects } : { string, fret };
  const gtr = staff(
    id,
    [
      bar(id, [
        voice(id, [
          beat(id, d(8), [
            n(3, 7, {
              bend: [
                { offset: 0, value: 0 },
                { offset: 30, value: 16 },
                { offset: 60, value: 16 },
              ],
            }),
          ]),
          beat(id, d(8), [n(3, 9, { slideIn: 'intoFromBelow', slideOut: 'legato' })]),
          beat(id, d(8), [n(3, 11, { slideOut: 'outDown' })]),
          beat(id, d(8), [n(2, 5, { slideIn: 'intoFromAbove', slideOut: 'outUp' })]),
          beat(id, d(8), [n(1, 12, { harmonic: { type: 'artificial', fret: 12 } })]),
          beat(id, d(8), [n(1, 5, { harmonic: { type: 'pinch', fret: 17 } })]),
          beat(id, d(8), [n(2, 7, { harmonic: { type: 'tap', fret: 19 } })]),
          beat(id, d(8), [n(2, 7, { harmonic: { type: 'semi', fret: 7 } })]),
        ]),
      ]),
      bar(id, [
        voice(id, [
          beat(id, d(8), [n(4, 5, { harmonic: { type: 'feedback', fret: 12 } })]),
          beat(id, d(8), [n(4, 7, { trill: { fret: 9, speed: 32 } })]),
          beat(id, d(8), [n(5, 0, { letRing: true, fingering: { left: 0, right: 'p' } })]),
          beat(id, d(8), [n(5, 3, { deadNote: true, fingering: { left: 3, right: 'i' } })]),
          beat(id, d(8), [n(4, 5, { ghost: true, fingering: { left: 5, right: 'c' } })]),
          beat(id, d(8), [n(4, 7, { staccato: true, accent: 'normal' })]),
          beat(id, d(8), [n(3, 7, { accent: 'heavy', vibrato: 'wide' })]),
          beat(id, d(8), [n(6, 3)], {
            effects: {
              whammy: [
                { offset: 0, value: 0 },
                { offset: 60, value: -8 },
              ],
            },
          }),
        ]),
      ]),
      bar(id, [
        voice(id, [
          beat(id, d(4), [n(1, 0), n(2, 1), n(3, 0)], { effects: { brush: { direction: 'up' } } }),
          beat(id, d(4), [n(4, 5)], { effects: { tremoloPicking: 16, vibrato: 'slight' } }),
          beat(id, d(8), [n(3, 5)], { effects: { pickStroke: 'up', tap: true } }),
          beat(id, d(8), [n(3, 7)], { effects: { pickStroke: 'down', slap: true } }),
          beat(id, d(8), [n(3, 5)], { effects: { pop: true, fadeIn: true } }),
          beat(id, d(8), [n(3, 7)], { effects: { tremoloPicking: 32 } }),
        ]),
      ]),
    ],
    {
      display: tab,
      stringed: { tuning: GUITAR_TUNING, capo: 3, fretCount: 24 },
      transpositionPitch: -12,
    },
  );
  const pno = staff(
    id,
    [
      bar(
        id,
        [
          voice(id, [
            beat(id, d(4), [{ pitch: 61, spelling: { step: 'D', alter: -1 }, velocity: 30 }], {
              dynamic: 'pp',
              effects: { crescendo: 'crescendo' },
            }),
            beat(id, d(4), [{ pitch: 61, spelling: { step: 'C', alter: 1 } }], { dynamic: 'mf' }),
            beat(id, d(4), [{ pitch: 60, spelling: { step: 'B', alter: 1 } }, { pitch: 63 }], {
              dynamic: 'fff',
              effects: { crescendo: 'decrescendo' },
            }),
            beat(id, d(4), [{ pitch: 62, spelling: { step: 'E', alter: -2 }, hand: 'left' }], {
              text: 'dolce',
            }),
          ]),
        ],
        { clef: 'G2', ottava: '15ma' },
      ),
      bar(id, [voice(id, quarters(id, [64, 66, 68, 69]))], { clef: 'C3', ottava: '8vb' }),
      bar(id, [voice(id, quarters(id, [57, 59, 60, 62]))], { clef: 'C4', ottava: '15mb' }),
    ],
    { hand: 'right' },
  );
  const masterBars = [
    { ...FIRST_BAR, keySignature: { fifths: -3, mode: 'minor' as const } },
    { keySignature: { fifths: 4, mode: 'major' as const } },
    { keySignature: { fifths: 7, mode: 'major' as const } },
  ];
  return documentOf(
    uuid(210),
    'Synthetic — effects, spelling and signatures',
    masterBars,
    [track(id, 'Guitar', guitar, [gtr]), track(id, 'Piano', piano, [pno], { color: 'track.2' })],
    id,
  );
}

/**
 * S-fermatas-ottava (decisions Q-D, Q-E): standard, short and long fermatas, several per bar, one
 * where no beat starts (warning), one on a beat at a non-integer alphaTab tick (7:4 septuplets),
 * and `Bar.ottava` on a bar with a grace beat, then 15mb, then no ottava (not carried forward).
 */
function fermatasOttava(): MhdDocument {
  const id = idSource('SF');
  const q = (p: number) => beat(id, d(4), [{ pitch: p }]);
  const masterBars = [
    { ...FIRST_BAR, fermatas: [{ position: [0, 1] as [number, number] }] },
    {
      fermatas: [
        { position: [1, 4] as [number, number], type: 'short' as const },
        { position: [3, 4] as [number, number], type: 'long' as const },
      ],
    },
    { fermatas: [{ position: [1, 8] as [number, number] }] },
    { fermatas: [{ position: [1, 7] as [number, number] }] },
    {},
    {},
    {},
  ];
  const bars = [
    bar(id, [voice(id, [q(72), q(74), q(76), q(77)])]),
    bar(id, [voice(id, [q(79), q(77), q(76), q(74)])]),
    bar(id, [voice(id, [q(72), q(71), q(72), q(74)])]),
    bar(id, [
      voice(
        id,
        Array.from({ length: 7 }, (_, i) => beat(id, d(4, 0, [7, 4]), [{ pitch: 72 + i }])),
      ),
    ]),
    bar(
      id,
      [
        voice(id, [
          beat(id, d(16), [{ pitch: 86 }], { grace: 'beforeBeat' }),
          q(88),
          q(89),
          q(91),
          q(93),
        ]),
      ],
      { ottava: '8va' },
    ),
    bar(id, [voice(id, [beat(id, d(2), [{ pitch: 41 }]), beat(id, d(2), [{ pitch: 43 }])])], {
      ottava: '15mb',
    }),
    bar(id, [voice(id, [beat(id, d(1), [{ pitch: 72 }])])]),
  ];
  return documentOf(
    uuid(211),
    'Synthetic — fermatas and ottava',
    masterBars,
    [track(id, 'Piano', piano, [staff(id, bars)])],
    id,
  );
}

export const SYNTHETIC_FIXTURES: Record<string, () => MhdDocument> = {
  'multi-voice': multiVoice,
  'multi-instrument': multiInstrument,
  rhythm,
  'ties-grace': tiesGrace,
  repeats,
  navigation,
  percussion,
  pedal,
  'long-sequence': longSequence,
  effects,
  'fermatas-ottava': fermatasOttava,
};
