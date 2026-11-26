// Dynamics before and between marks (ADR-0002 A23). MHD stores dynamic marks on beats; the
// dynamic of every other beat is derived: per staff and voice number, in score order (repeats and
// jumps do not rewind it), starting at `f`. A voice absent from some bars keeps its state.
import type { Beat, Staff } from '../schema/document.js';

export type Dynamic = NonNullable<Beat['dynamic']>;

/** Dynamic of a voice before its first mark. */
export const DEFAULT_DYNAMIC: Dynamic = 'f';

/** Effective dynamic of every beat of a staff, keyed by beat id. Pure; the staff is not changed. */
export function effectiveDynamics(staff: Pick<Staff, 'bars'>): Map<string, Dynamic> {
  const result = new Map<string, Dynamic>();
  const state: Dynamic[] = [];
  for (const bar of staff.bars) {
    bar.voices.forEach((voice, voiceNumber) => {
      let current = state[voiceNumber] ?? DEFAULT_DYNAMIC;
      for (const beat of voice.beats) {
        if (beat.dynamic) current = beat.dynamic;
        result.set(beat.id, current);
      }
      state[voiceNumber] = current;
    });
  }
  return result;
}
