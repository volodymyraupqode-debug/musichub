// Shared MHD → alphaTab value mappings used by both strategies (spike S2, ROADMAP.md S2-05).
// Only values are mapped here; how they reach alphaTab (model objects vs alphaTex) is strategy code.
// Every mapping was checked against alphaTab 1.9.0 (dist/alphaTab.core.mjs), see docs/spikes/s2-mhd-to-alphatab.md.
import type {
  Bar,
  Beat,
  Duration,
  MasterBar,
  MhdDocument,
  Note,
  Position,
  Staff,
  Track,
} from '@musichub/music-model';
import { PPQ } from '@musichub/music-model';

/** Ticks of an MHD rhythmic value (MUSIC_ENGINE.md §3.1), exact for every value MHD allows. */
export function durationTicks(d: Duration): number {
  let ticks = (PPQ * 4) / d.value;
  let add = ticks;
  for (let i = 0; i < d.dots; i++) {
    add /= 2;
    ticks += add;
  }
  if (d.tuplet) ticks = (ticks * d.tuplet.normal) / d.tuplet.actual;
  return ticks;
}

/** Length of a bar in ticks for a time signature. */
export function barTicks(ts: { numerator: number; denominator: number }): number {
  return (PPQ * 4 * ts.numerator) / ts.denominator;
}

export function positionRatio(p: Position): number {
  return p[0] / p[1];
}

/** alphaTab `DynamicValue` (PPP = 0 … FFF = 7). */
export const DYNAMIC: Record<NonNullable<Beat['dynamic']>, number> = {
  ppp: 0,
  pp: 1,
  p: 2,
  mp: 3,
  mf: 4,
  f: 5,
  ff: 6,
  fff: 7,
};

/** alphaTab `Clef` (Neutral 0, C3 1, C4 2, F4 3, G2 4). */
export const CLEF: Record<NonNullable<Bar['clef']>, number> = {
  neutral: 0,
  C3: 1,
  C4: 2,
  F4: 3,
  G2: 4,
};

/** alphaTab `Ottavia` (_15ma 0, _8va 1, Regular 2, _8vb 3, _15mb 4). */
export const OTTAVA: Record<NonNullable<Bar['ottava']> | 'regular', number> = {
  '15ma': 0,
  '8va': 1,
  regular: 2,
  '8vb': 3,
  '15mb': 4,
};

/** alphaTab `TripletFeel`. */
export const TRIPLET_FEEL: Record<NonNullable<MasterBar['tripletFeel']>, number> = {
  none: 0,
  '16th': 1,
  '8th': 2,
  dotted16th: 3,
  dotted8th: 4,
  scottish16th: 5,
  scottish8th: 6,
};

/** alphaTab `Direction`. MHD `toCoda` is the jump "Da Coda" (JumpDaCoda). */
export const DIRECTION: Record<NonNullable<MasterBar['direction']>, number> = {
  fine: 0,
  segno: 1,
  segnoSegno: 2,
  coda: 3,
  doubleCoda: 4,
  daCapo: 5,
  daCapoAlCoda: 6,
  daCapoAlFine: 8,
  dalSegno: 9,
  dalSegnoAlCoda: 10,
  dalSegnoAlFine: 12,
  toCoda: 17,
};

export const HARMONIC: Record<
  NonNullable<NonNullable<Note['effects']>['harmonic']>['type'],
  number
> = {
  natural: 1,
  artificial: 2,
  pinch: 3,
  tap: 4,
  semi: 5,
  feedback: 6,
};

export const SLIDE_OUT = { shift: 1, legato: 2, outUp: 3, outDown: 4 } as const;
export const SLIDE_IN = { intoFromBelow: 1, intoFromAbove: 2 } as const;
export const ACCENT = { normal: 1, heavy: 2 } as const;
export const VIBRATO = { slight: 1, wide: 2 } as const;
/** alphaTab `Fingers`: Thumb 0, Index 1, Middle 2, Annular 3, Little 4. */
export const RIGHT_FINGER = { p: 0, i: 1, m: 2, a: 3, c: 4 } as const;
/** alphaTab `TremoloPickingEffect.marks` for an MHD tremolo speed. */
export const TREMOLO_MARKS = { 8: 1, 16: 2, 32: 3 } as const;
/** alphaTab `NoteAccidentalMode` for `spelling.alter` (0 = Default: alphaTab decides). */
export const ACCIDENTAL_MODE: Record<number, number> = { [-2]: 6, [-1]: 5, 0: 0, 1: 3, 2: 4 };

/**
 * Left-hand finger. MHD allows 0..5 without documenting the numbering (open question Q-S2-4);
 * the spike assumes 0 = thumb … 4 = little finger and drops 5.
 */
export function leftFinger(n: number): number | undefined {
  return n <= 4 ? n : undefined;
}

/**
 * The alphaTab percussion articulation id for an MHD GM key and drum technique
 * (alphaTab PercussionMapper, ids are Guitar Pro articulation numbers).
 * `undefined` = alphaTab has no articulation for the pair.
 */
export function percussionArticulation(
  pitch: number,
  technique: Note['drumTechnique'],
): number | undefined {
  switch (technique) {
    case 'halfOpen':
      return 92; // "Hi-Hat (half)", sounds as GM 46 in alphaTab; 42 and 46 collapse
    case 'rimshot':
      return pitch === 38 ? 91 : undefined; // no rimshot for 40 (Electric Snare)
    case 'edge':
      return pitch === 51 ? 93 : 59; // alphaTab names GM 59 itself "Ride (edge) 2"
    case 'choke':
      return { 49: 97, 52: 96, 55: 95, 57: 98 }[pitch];
    case undefined:
      // alphaTab id 59 is the ride-2 *edge*; the plain ride-2 hit is 126 (also sounds as 59).
      return pitch === 59 ? 126 : KNOWN_ARTICULATION_IDS.has(pitch) ? pitch : undefined;
  }
}

/** GM keys that are also alphaTab articulation ids (PercussionMapper.instrumentArticulations). */
export const KNOWN_ARTICULATION_IDS = new Set([
  29, 30, 31, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53,
  54, 55, 56, 57, 58, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78,
  79, 80, 81, 82, 83, 84, 85, 86, 87,
]);

/** Clef a staff starts with when bar 0 omits it (MUSIC_ENGINE.md §3.3 rule 8: derived from the instrument). */
export function defaultClef(track: Track, staffIndex: number): NonNullable<Bar['clef']> {
  if (track.instrument.percussion) return 'neutral';
  if (track.instrument.family === 'bass') return 'F4';
  if (
    (track.instrument.family === 'piano' || track.instrument.family === 'synth') &&
    staffIndex === 1
  )
    return 'F4';
  return 'G2';
}

/** MHD string (1 = highest) → alphaTab string (1 = lowest). */
export function alphaTabString(staff: Staff, mhdString: number): number {
  const strings = staff.stringed?.tuning.length ?? 0;
  return strings - mhdString + 1;
}

/** alphaTab volume and balance are 0..16 (PlaybackInformation). */
export function mixerVolume(v: number): number {
  return Math.round(v * 16);
}
export function mixerBalance(pan: number): number {
  return Math.round((pan + 1) * 8);
}

/**
 * MIDI channels per track (alphaTab uses a primary and a secondary channel per track). Channel 9 is
 * only for percussion. Consecutive pairs while they fit; otherwise primaries are assigned first (15 melodic tracks at most get their own),
 * secondaries while channels are free; otherwise the secondary shares the primary. Beyond 15
 * melodic tracks primaries are shared too (MHD allows 64 tracks: open question for music-engine).
 */
export function channelsFor(doc: MhdDocument): { primary: number; secondary: number }[] {
  const free = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];
  const melodic = doc.tracks.map((t) => !t.instrument.percussion);
  if (melodic.filter(Boolean).length * 2 <= free.length) {
    // Enough channels: consecutive pairs, as alphaTab's importers assign them (but never 9).
    return melodic.map((m) =>
      m
        ? { primary: free.shift() ?? 0, secondary: free.shift() ?? 0 }
        : { primary: 9, secondary: 9 },
    );
  }
  const primary = melodic.map((m, i) => (m ? (free.shift() ?? i % 15) : 9));
  return melodic.map((m, i) => {
    const p = primary[i] ?? 9;
    return m ? { primary: p, secondary: free.shift() ?? p } : { primary: 9, secondary: 9 };
  });
}

/** Bitmask of alternate endings (alphaTab `MasterBar.alternateEndings`, bit n-1 = ending n). */
export function endingsMask(endings: readonly number[]): number {
  let mask = 0;
  for (const n of endings) mask |= 1 << (n - 1);
  return mask;
}

/** Time signature in force for every master bar (MHD stores only changes). */
export function resolvedTimeSignatures(
  doc: MhdDocument,
): { numerator: number; denominator: number }[] {
  let current = { numerator: 4, denominator: 4 };
  return doc.masterBars.map((mb) => {
    if (mb.timeSignature) current = mb.timeSignature;
    return current;
  });
}

/** Key signature in force for every master bar. */
export function resolvedKeySignatures(
  doc: MhdDocument,
): { fifths: number; mode: 'major' | 'minor' }[] {
  let current: { fifths: number; mode: 'major' | 'minor' } = { fifths: 0, mode: 'major' };
  return doc.masterBars.map((mb) => {
    if (mb.keySignature) current = mb.keySignature;
    return current;
  });
}

/** Default brush span when MHD omits it: the alphaTex default (beat duration × 0.25 / notes). */
export function defaultBrushTicks(beat: Beat): number {
  return (durationTicks(beat.duration) * 0.25) / Math.max(beat.notes.length, 1);
}

/** Copy of alphaTab's internal ModelUtils.deltaFretToHarmonicValue (used by alphaTex `nh`). */
export function naturalHarmonicValue(fret: number): number {
  switch (fret) {
    case 2:
      return 2.4;
    case 3:
      return 3.2;
    case 4:
    case 5:
    case 7:
    case 9:
    case 12:
    case 16:
    case 17:
    case 19:
    case 24:
      return fret;
    case 8:
      return 8.2;
    case 10:
      return 9.6;
    case 14:
    case 15:
      return 14.7;
    case 21:
    case 22:
      return 21.7;
    default:
      return 12;
  }
}
