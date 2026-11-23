// Playback parity: the MIDI alphaTab generates from a Score (MidiFileGenerator, the same path the
// player uses). Equal event lists mean equal audible playback for the two strategies.
import * as alphaTab from '@coderline/alphatab';
import type { PlaybackScore } from './scores.ts';

export interface MidiSummary {
  noteOns: number;
  /** Control change 64 (sustain pedal) events: alphaTab 1.9 does not generate them (spike S7). */
  sustainEvents: number;
  tempoEvents: number;
  /** Normalised events: note on/off with tick, channel, key, velocity; control and program changes; tempo. */
  events: string[];
}

/** MIDI of a Playback Score. A Render Score is rejected at compile time (see scores.ts). */
export function midiSummary(score: PlaybackScore, settings: alphaTab.Settings): MidiSummary {
  const midiFile = new alphaTab.midi.MidiFile();
  const handler = new alphaTab.midi.AlphaSynthMidiFileHandler(midiFile, true);
  new alphaTab.midi.MidiFileGenerator(score, settings, handler).generate();
  const out: MidiSummary = { noteOns: 0, sustainEvents: 0, tempoEvents: 0, events: [] };
  for (const e of midiFile.events) {
    if (e instanceof alphaTab.midi.NoteOnEvent) {
      out.noteOns++;
      out.events.push(`on ${e.tick} ch${e.channel} k${e.noteKey} v${e.noteVelocity}`);
    } else if (e instanceof alphaTab.midi.NoteOffEvent) {
      out.events.push(`off ${e.tick} ch${e.channel} k${e.noteKey}`);
    } else if (e instanceof alphaTab.midi.ControlChangeEvent) {
      if (e.controller === 64) out.sustainEvents++;
      out.events.push(`cc ${e.tick} ch${e.channel} c${e.controller} ${e.value}`);
    } else if (e instanceof alphaTab.midi.ProgramChangeEvent) {
      out.events.push(`pc ${e.tick} ch${e.channel} p${e.program}`);
    } else if (e instanceof alphaTab.midi.TempoChangeEvent) {
      out.tempoEvents++;
      out.events.push(`tempo ${e.tick} ${e.beatsPerMinute}`);
    }
  }
  // Same-tick ordering is not meaningful; sort for a stable comparison.
  out.events.sort();
  return out;
}

/**
 * Differing events of two summaries (empty = identical playback). With `ignoreChannels`, MIDI
 * channel numbers, controller and program changes are left out: alphaTex has no syntax for channels, so the
 * importer assigns its own (one pair per track, also for percussion tracks).
 */
export function midiDiff(a: MidiSummary, b: MidiSummary, ignoreChannels = false): string[] {
  const norm = (events: string[]) =>
    ignoreChannels
      ? events
          .filter((e) => !e.startsWith('cc') && !e.startsWith('pc'))
          .map((e) => e.replace(/ ch\d+/, ''))
      : events;
  const count = new Map<string, number>();
  for (const e of norm(a.events)) count.set(e, (count.get(e) ?? 0) + 1);
  const diff: string[] = [];
  for (const e of norm(b.events)) {
    const c = count.get(e) ?? 0;
    if (c > 0) count.set(e, c - 1);
    else diff.push(`+B ${e}`);
  }
  for (const [e, c] of count) for (let i = 0; i < c; i++) diff.push(`+A ${e}`);
  return diff;
}
