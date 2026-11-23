// Small deterministic builders for synthetic MHD v1 documents (spike only).
import type {
  Bar,
  Beat,
  Duration,
  MasterBar,
  MhdDocument,
  Note,
  Staff,
  Track,
  Voice,
} from '@musichub/music-model';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Sequential 12-character base62 ids with a 2-character prefix. */
export function idSource(prefix: string): () => string {
  let n = 0;
  return () => {
    n++;
    let s = '';
    let v = n;
    while (v > 0) {
      s = BASE62[v % 62] + s;
      v = Math.floor(v / 62);
    }
    return prefix + s.padStart(10, '0');
  };
}

export type Id = () => string;

export const d = (
  value: Duration['value'],
  dots: Duration['dots'] = 0,
  tuplet?: [number, number],
): Duration =>
  tuplet ? { value, dots, tuplet: { actual: tuplet[0], normal: tuplet[1] } } : { value, dots };

export function rest(id: Id, duration: Duration, extra: Partial<Beat> = {}): Beat {
  return { id: id(), duration, rest: true, notes: [], ...extra };
}

export function beat(
  id: Id,
  duration: Duration,
  notes: Omit<Note, 'id'>[],
  extra: Partial<Beat> = {},
): Beat {
  return {
    id: id(),
    duration,
    rest: false,
    notes: notes.map((n) => ({ id: id(), ...n })),
    ...extra,
  };
}

export const voice = (id: Id, beats: Beat[]): Voice => ({ id: id(), beats });
export const bar = (id: Id, voices: Voice[], extra: Partial<Bar> = {}): Bar => ({
  id: id(),
  ...extra,
  voices,
});

export function staff(id: Id, bars: Bar[], extra: Partial<Omit<Staff, 'id' | 'bars'>> = {}): Staff {
  return {
    id: id(),
    display: { standard: true, tab: false, slash: false, numbered: false },
    ...extra,
    bars,
  };
}

export const GUITAR_TUNING = [64, 59, 55, 50, 45, 40];
export const BASS_TUNING = [43, 38, 33, 28];

export function track(
  id: Id,
  name: string,
  instrument: Track['instrument'],
  staves: Staff[],
  extra: Partial<Omit<Track, 'id' | 'staves' | 'instrument'>> = {},
): Track {
  return {
    id: id(),
    name,
    color: 'track.1',
    instrument,
    mixer: { volume: 0.8, pan: 0, mute: false, solo: false },
    ...extra,
    staves,
  };
}

export function documentOf(
  uuid: string,
  title: string,
  masterBars: Omit<MasterBar, 'id'>[],
  tracks: Track[],
  id: Id,
): MhdDocument {
  return {
    format: 'musichub',
    schemaVersion: 1,
    id: uuid,
    meta: { title, copyright: 'MusicHub test fixture' },
    masterBars: masterBars.map((m) => ({ id: id(), ...m })),
    tracks,
  };
}

export const FIRST_BAR: Omit<MasterBar, 'id'> = {
  timeSignature: { numerator: 4, denominator: 4 },
  keySignature: { fifths: 0, mode: 'major' },
  tempoChanges: [{ position: [0, 1], bpm: 120 }],
};

/** n quarter notes of a pitch (or rests when pitch is null). */
export function quarters(id: Id, pitches: (number | null)[]): Beat[] {
  return pitches.map((p) => (p === null ? rest(id, d(4)) : beat(id, d(4), [{ pitch: p }])));
}
