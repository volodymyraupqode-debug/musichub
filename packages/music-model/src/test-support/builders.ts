// Test-only document builders (excluded from the build). Ids are deterministic and readable.
import type { Bar, Beat, MhdDocument, Note, Staff, Track } from '../schema/document.js';

let counter = 0;

/** Deterministic 12-character base62 id, e.g. `T00000000042`. */
export function testId(): string {
  counter += 1;
  return `T${String(counter).padStart(11, '0')}`;
}

/** Deterministic lowercase UUIDv7 for document ids, e.g. `0195f2a4-7c3e-7a10-9b2d-000000000042`. */
export function testDocumentId(): string {
  counter += 1;
  return `0195f2a4-7c3e-7a10-9b2d-${String(counter).padStart(12, '0')}`;
}

export const STANDARD_TUNING = [64, 59, 55, 50, 45, 40];

export function note(fields: Omit<Note, 'id'>): Note {
  return { id: testId(), ...fields };
}

export function beat(
  value: Beat['duration']['value'],
  notes: Note[],
  extra: Partial<Omit<Beat, 'id'>> = {},
): Beat {
  return { id: testId(), duration: { value, dots: 0 }, rest: false, notes, ...extra };
}

export function rest(value: Beat['duration']['value'] = 1): Beat {
  return { id: testId(), duration: { value, dots: 0 }, rest: true, notes: [] };
}

export function bar(beats: Beat[], extra: Partial<Omit<Bar, 'id' | 'voices'>> = {}): Bar {
  return { id: testId(), voices: [{ id: testId(), beats }], ...extra };
}

export function guitarStaff(bars: Bar[]): Staff {
  return {
    id: testId(),
    display: { standard: true, tab: true, slash: false, numbered: false },
    stringed: { tuning: [...STANDARD_TUNING], capo: 0, fretCount: 24 },
    transpositionPitch: -12,
    bars,
  };
}

export function pitchStaff(bars: Bar[], extra: Partial<Omit<Staff, 'id' | 'bars'>> = {}): Staff {
  return {
    id: testId(),
    display: { standard: true, tab: false, slash: false, numbered: false },
    bars,
    ...extra,
  };
}

export function track(
  family: Track['instrument']['family'],
  staves: Staff[],
  percussion = false,
): Track {
  return {
    id: testId(),
    name: family,
    color: 'track.1',
    instrument: { family, midiProgram: percussion ? 0 : 25, percussion },
    mixer: { volume: 0.8, pan: 0, mute: false, solo: false },
    staves,
  };
}

/** A valid one-bar 4/4 document with one guitar track playing open string 1 for a whole note. */
export function minimalDocument(): MhdDocument {
  return {
    format: 'musichub',
    schemaVersion: 1,
    id: testDocumentId(),
    meta: { title: 'Minimal' },
    masterBars: [
      {
        id: testId(),
        timeSignature: { numerator: 4, denominator: 4 },
        keySignature: { fifths: 0, mode: 'major' },
        tempoChanges: [{ position: [0, 1], bpm: 120 }],
      },
    ],
    tracks: [track('guitar', [guitarStaff([bar([beat(1, [note({ string: 1, fret: 0 })])])])])],
  };
}

/** A valid document with `barCount` 4/4 bars; `staves` builds the staves for that many bars. */
export function documentWith(
  tracks: Track[],
  barCount = tracks[0]?.staves[0]?.bars.length ?? 1,
): MhdDocument {
  const base = minimalDocument();
  const masterBars = [...base.masterBars];
  for (let index = 1; index < barCount; index += 1) masterBars.push({ id: testId() });
  return { ...base, masterBars, tracks };
}

/** Recursively freezes a value so a mutation attempt throws in strict mode. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
