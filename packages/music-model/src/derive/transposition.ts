// Written notation of transposing staves (ADR-0002 A22). MHD stores concert (sounding) data:
// `MasterBar.keySignature` is the concert key, `Note.pitch` and `Note.spelling` are sounding.
// The written key and spelling of a staff are derived here and never stored. Pure functions:
// they never change the document, `Note.pitch` or `Note.spelling`.
import type { KeySignature, MasterBar, Note, Staff } from '../schema/document.js';

type Spelling = NonNullable<Note['spelling']>;
type Step = Spelling['step'];

const mod = (value: number, divisor: number): number => ((value % divisor) + divisor) % divisor;

/**
 * Fifths shift from the concert key to the written key of a staff with `transpositionPitch`
 * (sounding = written + transpositionPitch). Semitones only; among the enharmonic candidates the
 * written key with the fewest accidentals wins; at a tie of ±6 the concert key's sign decides,
 * sharps for a concert key of C.
 */
export function writtenKeyShift(concert: KeySignature, transpositionPitch: number): number {
  const semitones = mod(-transpositionPitch, 12);
  if (semitones === 0) return 0;
  const base = concert.fifths + mod(7 * semitones, 12);
  const candidates = [base - 24, base - 12, base, base + 12].filter((f) => Math.abs(f) <= 7);
  const fewest = Math.min(...candidates.map((f) => Math.abs(f)));
  const tied = candidates.filter((f) => Math.abs(f) === fewest);
  // Only ±6 can tie (F♯ / G♭ and their minor keys).
  const best = tied.length === 1 ? (tied[0] as number) : concert.fifths < 0 ? -fewest : fewest;
  return best - concert.fifths;
}

/** Written key signature of a staff for a concert key (mode unchanged). */
export function writtenKeySignature(
  concert: KeySignature,
  transpositionPitch: number,
): KeySignature {
  const shift = writtenKeyShift(concert, transpositionPitch);
  return shift === 0 ? concert : { fifths: concert.fifths + shift, mode: concert.mode };
}

/** Concert key in force at a master bar: the last key signature at or before it (bar 0 sets one). */
export function concertKeyAt(
  masterBars: readonly MasterBar[],
  masterBarIndex: number,
): KeySignature {
  for (let index = Math.min(masterBarIndex, masterBars.length - 1); index >= 0; index--) {
    const key = masterBars[index]?.keySignature;
    if (key) return key;
  }
  return { fifths: 0, mode: 'major' };
}

/** Written key signature of `staff` at a master bar. */
export function writtenKeyAt(
  masterBars: readonly MasterBar[],
  masterBarIndex: number,
  staff: Pick<Staff, 'transpositionPitch'>,
): KeySignature {
  return writtenKeySignature(
    concertKeyAt(masterBars, masterBarIndex),
    staff.transpositionPitch ?? 0,
  );
}

// Line of fifths: F C G D A E B, then the same letters one accidental higher.
const FIFTHS_ORDER: readonly Step[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];

function toFifths(spelling: Spelling): number {
  return FIFTHS_ORDER.indexOf(spelling.step) - 1 + 7 * spelling.alter;
}

function fromFifths(fifths: number): Spelling {
  const index = mod(fifths + 1, 7);
  return { step: FIFTHS_ORDER[index] as Step, alter: Math.floor((fifths + 1) / 7) };
}

/**
 * Written spelling of a sounding spelling on a staff, shifted by the same fifths step as the
 * staff's written key at that bar, so key signature and notes agree. When the result needs more
 * than a double accidental (MHD `alter` −2…2), the enharmonic with the same pitch class closest to
 * the written key on the line of fifths is used.
 */
export function writtenSpelling(
  sounding: Spelling,
  concert: KeySignature,
  transpositionPitch: number,
): Spelling {
  const shift = writtenKeyShift(concert, transpositionPitch);
  const target = toFifths(sounding) + shift;
  const direct = fromFifths(target);
  if (Math.abs(direct.alter) <= 2) return direct;
  const written = concert.fifths + shift;
  const candidates = [target - 12, target + 12].filter(
    (fifths) => Math.abs(fromFifths(fifths).alter) <= 2,
  );
  candidates.sort((a, b) => Math.abs(a - written) - Math.abs(b - written));
  return fromFifths(candidates[0] ?? target);
}

/** Written MIDI pitch of a sounding pitch on a staff (sounding = written + transpositionPitch). */
export function writtenPitch(soundingPitch: number, transpositionPitch: number): number {
  return soundingPitch - transpositionPitch;
}
