// Spike S3 (ROADMAP S2-10): a single-note edit as an editor-core command would perform it
// (MUSIC_ENGINE.md §6: "editor-core command ─▶ new immutable MHD (structural sharing)").
// editor-core does not exist yet, so this is a model of the command, not the real one.
// Browser-safe: type-only imports, no Node APIs (the harness loads it with types stripped).
import type { Bar, Beat, MhdDocument, Note, Staff, Track, Voice } from '@musichub/music-model';

export interface NoteRef {
  track: number;
  staff: number;
  bar: number;
  voice: number;
  beat: number;
  note: number;
  id: string;
}

/** Every note of a track, in bar order (the candidates for an edit). */
export function notesOf(doc: MhdDocument, track = 0): NoteRef[] {
  const out: NoteRef[] = [];
  doc.tracks[track]?.staves.forEach((s, si) =>
    s.bars.forEach((b, bi) =>
      b.voices.forEach((v, vi) =>
        v.beats.forEach((bt, bti) =>
          bt.notes.forEach((n, ni) =>
            out.push({ track, staff: si, bar: bi, voice: vi, beat: bti, note: ni, id: n.id }),
          ),
        ),
      ),
    ),
  );
  return out;
}

/**
 * Changes one note by `delta`: the fret on a stringed staff (kept in 0…fretCount), else the pitch
 * (kept in 0…127). Returns a new document that shares every unchanged object with `doc`.
 */
export function editNote(doc: MhdDocument, ref: NoteRef, delta: number): MhdDocument {
  const track = doc.tracks[ref.track];
  const staff = track?.staves[ref.staff];
  const bar = staff?.bars[ref.bar];
  const voice = bar?.voices[ref.voice];
  const beat = voice?.beats[ref.beat];
  const note = beat?.notes[ref.note];
  if (!track || !staff || !bar || !voice || !beat || !note || note.id !== ref.id)
    throw new Error(`note ${ref.id} not found`);
  let changed: Note;
  if (note.fret !== undefined) {
    const max = staff.stringed?.fretCount ?? 24;
    const fret = note.fret + delta;
    changed = { ...note, fret: fret < 0 || fret > max ? note.fret - delta : fret };
  } else {
    const pitch = (note.pitch ?? 60) + delta;
    changed = { ...note, pitch: pitch < 0 || pitch > 127 ? (note.pitch ?? 60) - delta : pitch };
  }
  const swap = <T>(list: readonly T[], index: number, value: T): T[] =>
    list.map((x, i) => (i === index ? value : x));
  const newBeat: Beat = { ...beat, notes: swap(beat.notes, ref.note, changed) };
  const newVoice: Voice = { ...voice, beats: swap(voice.beats, ref.beat, newBeat) };
  const newBar: Bar = { ...bar, voices: swap(bar.voices, ref.voice, newVoice) };
  const newStaff: Staff = { ...staff, bars: swap(staff.bars, ref.bar, newBar) };
  const newTrack: Track = { ...track, staves: swap(track.staves, ref.staff, newStaff) };
  return { ...doc, tracks: swap(doc.tracks, ref.track, newTrack) };
}
