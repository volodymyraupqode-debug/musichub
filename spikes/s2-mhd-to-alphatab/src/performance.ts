// Performance document for spike S2: 300 master bars × 8 tracks with realistic content.
// It is a benchmark input only, not evidence of musical correctness.
import type { MhdDocument } from '@musichub/music-model';
import {
  BASS_TUNING,
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
} from './builders.ts';

export const PERF_BARS = 300;

export function performanceDocument(bars = PERF_BARS): MhdDocument {
  const id = idSource('PF');
  const range = (n: number) => Array.from({ length: n }, (_, i) => i);
  const tab = { standard: true, tab: true, slash: false, numbered: false };
  const masterBars = range(bars).map((i) => {
    if (i === 0) return FIRST_BAR;
    const m: Record<string, unknown> = {};
    if (i % 16 === 0) m.repeatStart = true;
    if (i % 16 === 7) m.repeatEnd = { count: 2 };
    if (i % 32 === 0) m.section = { text: `Part ${i / 32 + 1}` };
    if (i % 50 === 25) m.tempoChanges = [{ position: [0, 1], bpm: 110 + (i % 20) }];
    return m;
  });
  const leadGuitar = staff(
    id,
    range(bars).map((b) =>
      bar(id, [
        voice(
          id,
          range(8).map((i) =>
            i === 7 && b % 4 === 3
              ? rest(id, d(8))
              : beat(
                  id,
                  d(8),
                  [{ string: 1 + ((b + i) % 3), fret: 5 + ((b * 7 + i * 3) % 10) }],
                  i % 4 === 0 ? { effects: { vibrato: 'slight' } } : {},
                ),
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
  const rhythmGuitar = staff(
    id,
    range(bars).map((b) =>
      bar(id, [
        voice(
          id,
          range(4).map((i) =>
            beat(
              id,
              d(4),
              [
                { string: 6, fret: (b % 5) + 3 },
                { string: 5, fret: (b % 5) + 5 },
                { string: 4, fret: (b % 5) + 5 },
              ],
              { effects: { pickStroke: i % 2 === 0 ? 'down' : 'up' } },
            ),
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
  const bass = staff(
    id,
    range(bars).map((b) =>
      bar(id, [
        voice(
          id,
          range(8).map((i) => beat(id, d(8), [{ string: 4 - (i % 2), fret: (b + i) % 7 }])),
        ),
      ]),
    ),
    {
      display: { standard: false, tab: true, slash: false, numbered: false },
      stringed: { tuning: BASS_TUNING, capo: 0, fretCount: 20 },
      transpositionPitch: -12,
    },
  );
  const drums = staff(
    id,
    range(bars).map(() =>
      bar(id, [
        voice(
          id,
          range(8).map((i) =>
            beat(
              id,
              d(8),
              i % 4 === 0
                ? [{ pitch: 36 }, { pitch: 42 }]
                : i % 4 === 2
                  ? [{ pitch: 38 }, { pitch: 42 }]
                  : [{ pitch: 42, ...(i === 7 ? { drumTechnique: 'halfOpen' as const } : {}) }],
            ),
          ),
        ),
      ]),
    ),
  );
  const pianoRh = staff(
    id,
    range(bars).map((b) =>
      bar(id, [
        voice(
          id,
          range(8).map((i) => beat(id, d(8), [{ pitch: 72 + ((b + i * 2) % 12) }])),
        ),
        voice(id, [
          beat(id, d(2), [{ pitch: 64 }, { pitch: 67 }]),
          beat(id, d(2), [{ pitch: 65 }, { pitch: 69 }]),
        ]),
      ]),
    ),
    { hand: 'right' },
  );
  const pianoLh = staff(
    id,
    range(bars).map((b) =>
      bar(
        id,
        [
          voice(id, [
            beat(id, d(2), [{ pitch: 36 + (b % 12) }, { pitch: 43 + (b % 12) }]),
            beat(id, d(2), [{ pitch: 41 + (b % 7) }]),
          ]),
        ],
        {
          ...(b === 0 ? { clef: 'F4' as const } : {}),
          sustainPedal: [
            { position: [0, 1], type: 'down' },
            { position: [7, 8], type: 'up' },
          ],
        },
      ),
    ),
    { hand: 'left' },
  );
  const strings = staff(
    id,
    range(bars).map((b) =>
      bar(id, [
        voice(id, [
          beat(id, d(1), [
            { pitch: 55 + (b % 12) },
            { pitch: 62 + (b % 12) },
            ...(b % 2 ? [] : [{ pitch: 67 + (b % 12) }]),
          ]),
        ]),
      ]),
    ),
  );
  const lead = staff(
    id,
    range(bars).map((b) =>
      bar(id, [
        voice(id, [
          beat(id, d(4, 1), [{ pitch: 76 + (b % 5) }]),
          beat(id, d(8), [{ pitch: 74 }]),
          beat(id, d(8, 0, [3, 2]), [{ pitch: 72 }]),
          beat(id, d(8, 0, [3, 2]), [{ pitch: 74 }]),
          beat(id, d(8, 0, [3, 2]), [{ pitch: 76 }]),
          b % 2 ? rest(id, d(4)) : beat(id, d(4), [{ pitch: 79 }]),
        ]),
      ]),
    ),
  );
  const tracks = [
    track(
      id,
      'Lead guitar',
      { family: 'guitar', midiProgram: 29, percussion: false },
      [leadGuitar],
      { color: 'track.1' },
    ),
    track(
      id,
      'Rhythm guitar',
      { family: 'guitar', midiProgram: 30, percussion: false },
      [rhythmGuitar],
      { color: 'track.2' },
    ),
    track(id, 'Bass', { family: 'bass', midiProgram: 33, percussion: false }, [bass], {
      color: 'track.3',
    }),
    track(id, 'Drums', { family: 'drums', midiProgram: 0, percussion: true }, [drums], {
      color: 'track.4',
    }),
    track(id, 'Piano', { family: 'piano', midiProgram: 0, percussion: false }, [pianoRh, pianoLh], {
      color: 'track.5',
    }),
    track(id, 'Strings', { family: 'strings', midiProgram: 48, percussion: false }, [strings], {
      color: 'track.6',
    }),
    track(id, 'Lead synth', { family: 'synth', midiProgram: 81, percussion: false }, [lead], {
      color: 'track.7',
    }),
    track(
      id,
      'Pad',
      { family: 'synth', midiProgram: 89, percussion: false },
      [
        staff(
          id,
          range(bars).map((b) =>
            bar(id, [
              voice(id, [beat(id, d(1), [{ pitch: 60 + (b % 7) }, { pitch: 64 + (b % 7) }])]),
            ]),
          ),
        ),
      ],
      { color: 'track.8' },
    ),
  ];
  return documentOf(
    '01900000-0000-7000-8000-000000000300',
    'Synthetic — performance 300 × 8',
    masterBars as never,
    tracks,
    id,
  );
}
