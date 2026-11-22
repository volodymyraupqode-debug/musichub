// Test-only helpers for the canonical fixtures (excluded from the build, not exported).
// Sidecar format and counting rules: fixtures/v1/README.md.
import { z } from 'zod';
import { MHD_SCHEMA_VERSION } from '../constants.js';
import type { Beat, MhdDocument, Note, Staff } from '../schema/document.js';

const count = z.int().min(0);

/** `<name>.expected.json`: deterministic validation result and structural counts only. */
export const FixtureExpectationSchema = z.strictObject({
  fixture: z.string().regex(/^[a-z0-9-]+\.mhd\.json$/),
  schemaVersion: z.literal(MHD_SCHEMA_VERSION),
  validation: z.strictObject({ valid: z.boolean(), issueCodes: z.array(z.string()) }),
  counts: z.strictObject({
    tracks: count,
    staves: count,
    masterBars: count,
    voices: count,
    beats: count,
    rests: count,
    notes: count,
    graceBeats: count,
    tiedNotes: count,
    sustainPedalEvents: count,
  }),
});

export type FixtureExpectation = z.infer<typeof FixtureExpectationSchema>;
export type FixtureCounts = FixtureExpectation['counts'];

/** Structural counts of a document, without any derived playback data (no repeat expansion). */
export function countStructure(doc: MhdDocument): FixtureCounts {
  const counts: FixtureCounts = {
    tracks: doc.tracks.length,
    staves: 0,
    masterBars: doc.masterBars.length,
    voices: 0,
    beats: 0,
    rests: 0,
    notes: 0,
    graceBeats: 0,
    tiedNotes: 0,
    sustainPedalEvents: 0,
  };
  for (const track of doc.tracks) {
    for (const staff of track.staves) {
      counts.staves += 1;
      counts.tiedNotes += tiedNoteIds(staff).size;
      for (const bar of staff.bars) {
        counts.sustainPedalEvents += bar.sustainPedal?.length ?? 0;
        for (const voice of bar.voices) {
          counts.voices += 1;
          for (const beat of voice.beats) {
            counts.beats += 1;
            counts.notes += beat.notes.length;
            if (beat.rest) counts.rests += 1;
            if (beat.grace !== undefined) counts.graceBeats += 1;
          }
        }
      }
    }
  }
  return counts;
}

/**
 * Ids of every note that takes part in a tie: each `tiedFromPrevious` note and the note it
 * continues in the previous beat of the same voice (same string and fret on stringed staves,
 * same pitch otherwise). A note is counted once even when it both ends and starts a tie.
 */
function tiedNoteIds(staff: Staff): Set<string> {
  const ids = new Set<string>();
  staff.bars.forEach((bar, barIndex) => {
    bar.voices.forEach((voice, voiceIndex) => {
      voice.beats.forEach((beat, beatIndex) => {
        const previous =
          beatIndex > 0
            ? voice.beats[beatIndex - 1]
            : staff.bars[barIndex - 1]?.voices[voiceIndex]?.beats.at(-1);
        for (const note of beat.notes) {
          if (note.tiedFromPrevious !== true) continue;
          ids.add(note.id);
          const origin = previous && findOrigin(staff, previous, note);
          if (origin) ids.add(origin.id);
        }
      });
    });
  });
  return ids;
}

function findOrigin(staff: Staff, previous: Beat, note: Note): Note | undefined {
  return previous.notes.find((candidate) =>
    staff.stringed
      ? candidate.string === note.string && candidate.fret === note.fret
      : candidate.pitch === note.pitch,
  );
}
