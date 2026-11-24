// Spike S5: reference MIDI events from alphaTab 1.9.0 (MidiFileGenerator on the Playback Score).
import * as alphaTab from '@coderline/alphatab';
import type { MhdDocument } from '@musichub/music-model';
import { playbackDocument, type ChannelPlan } from '../channels.ts';
import type { PlaybackScore } from '../scores.ts';
import type { TimelineEvent } from './prototype.ts';

/**
 * Note on/off and tempo events with their MHD track id. The Playback Score's track order is the
 * order of the playable MHD tracks (`playbackDocument`), so `event.track` maps to an MHD id.
 */
export function referenceEvents(
  doc: MhdDocument,
  plan: ChannelPlan,
  score: PlaybackScore,
  settings: alphaTab.Settings,
): TimelineEvent[] {
  const trackIds = playbackDocument(doc, plan).tracks.map((t) => t.id);
  const midi = new alphaTab.midi.MidiFile();
  new alphaTab.midi.MidiFileGenerator(
    score,
    settings,
    new alphaTab.midi.AlphaSynthMidiFileHandler(midi, true),
  ).generate();
  const events: TimelineEvent[] = [];
  for (const e of midi.events) {
    if (e instanceof alphaTab.midi.NoteOnEvent || e instanceof alphaTab.midi.NoteOffEvent) {
      const trackId = trackIds[e.track];
      events.push({
        type: e instanceof alphaTab.midi.NoteOnEvent ? 'noteOn' : 'noteOff',
        tick: e.tick,
        ...(trackId ? { trackId } : {}),
        channel: e.channel,
        key: e.noteKey,
        velocity: e.noteVelocity,
      });
    } else if (e instanceof alphaTab.midi.TempoChangeEvent) {
      events.push({ type: 'tempo', tick: e.tick, bpm: e.beatsPerMinute });
    }
  }
  return events;
}
