// Spike S7 (ROADMAP S2-07): let alphaTab 1.9.0's player play a Playback Score while the API
// renders a different Render Score. alphaTab has no API for this: `loadMidiForScore()` always
// generates MIDI from `api.score`, the rendered Score. The hook below rewrites that MIDI in the
// public `midiLoad` event, which alphaTab fires synchronously with the very `MidiFile` object it
// passes to `player.loadMidiFile` next (alphaTab.core.mjs, AlphaTabApiBase.loadMidiForScore).
//
// Browser-safe on purpose: it imports only alphaTab, so the browser harness serves this file with
// its types stripped (no bundler). Never import Node or spike modules here.
import * as alphaTab from '@coderline/alphatab';

type Score = alphaTab.model.Score;
type MidiFile = alphaTab.midi.MidiFile;

export interface PlaybackMidi {
  midi: MidiFile;
  /** Tick shift the Playback Score would get on its own; never larger than the Render Score's. */
  naturalTickShift: number;
  /** Tick shift written into `midi` (the Render Score's, so both share one time axis). */
  tickShift: number;
  /** Channel → semitones, as MidiFileGenerator reports them (`applyTranspositionPitches`). */
  transpositionPitches: Map<number, number>;
  /** Beat lookup of the Playback Score (unshifted ticks). */
  tickLookup: alphaTab.midi.MidiTickLookup;
}

/**
 * The Playback Score's MIDI, generated like `AlphaTabApiBase.loadMidiForScore` does (default
 * handler, `applyTranspositionPitches = false`), but on the given tick shift. alphaTab sets the
 * player's `midiTickShift` from the Render Score after `midiLoad`, so the Playback MIDI must use
 * the same shift; with the Playback Score's own shift a cursor offset would follow (E3-grace).
 */
export function generatePlaybackMidi(
  score: Score,
  settings: alphaTab.Settings,
  tickShift?: number,
): PlaybackMidi {
  const midi = new alphaTab.midi.MidiFile();
  let natural = 0;
  class FixedShiftHandler extends alphaTab.midi.AlphaSynthMidiFileHandler {
    override addTickShift(shift: number): void {
      natural = shift;
      super.addTickShift(tickShift ?? shift);
    }
  }
  const generator = new alphaTab.midi.MidiFileGenerator(
    score,
    settings,
    new FixedShiftHandler(midi),
  );
  generator.applyTranspositionPitches = false;
  generator.generate();
  return {
    midi,
    naturalTickShift: natural,
    tickShift: midi.tickShift,
    transpositionPitches: new Map(generator.transpositionPitches),
    tickLookup: generator.tickLookup,
  };
}

/**
 * Channel → mix volume exactly as alphaTab's `readyForPlayback` handler sets them
 * (`_setupPlayerWrapper`: volume / 16 for the primary and secondary channel, in track order).
 */
export function channelVolumes(tracks: readonly alphaTab.model.Track[]): Map<number, number> {
  const volumes = new Map<number, number>();
  for (const track of tracks) {
    const volume = track.playbackInfo.volume / 16;
    volumes.set(track.playbackInfo.primaryChannel, volume);
    volumes.set(track.playbackInfo.secondaryChannel, volume);
  }
  return volumes;
}

/**
 * Replaces the content of the MIDI file alphaTab generated from the Render Score by the Playback
 * Score's MIDI on the same tick shift. Throws if the Playback Score needs a larger shift, which
 * cannot happen when its tracks are a subset of the Render Score's.
 */
export function rewriteMidiFile(
  file: MidiFile,
  playback: Score,
  settings: alphaTab.Settings,
): PlaybackMidi {
  const result = generatePlaybackMidi(playback, settings, file.tickShift);
  if (result.naturalTickShift > file.tickShift)
    throw new Error(
      `Playback Score needs tick shift ${result.naturalTickShift}, Render Score has ${file.tickShift}`,
    );
  file.tracks.splice(0, file.tracks.length, ...result.midi.tracks); // `tracks` is read-only
  return result;
}

/** The part of `AlphaTabApi` the hook uses (structural, so the type stays honest in tests). */
export interface HookTarget {
  readonly score: Score | null;
  readonly settings: alphaTab.Settings;
  readonly player: alphaTab.synth.IAlphaSynth | null;
  readonly midiLoad: alphaTab.IEventEmitterOfT<MidiFile>;
  readonly playerReady: alphaTab.IEventEmitter;
}

export interface HookStats {
  midiLoads: number;
  rewritten: number;
  /** midiLoad events without a Playback Score: the hook empties the MIDI (fail closed). */
  failures: string[];
  lastTickShift?: number;
  lastNaturalTickShift?: number;
}

/**
 * Installs the hook. `playbackFor` returns the Playback Score of a Render Score (identity map
 * kept by the caller). Corrections after alphaTab's own steps of `loadMidiForScore`:
 * - transposition pitches: alphaTab applies the Render Score's map after `midiLoad`; the hook
 *   re-applies the Playback Score's map in a microtask (after the synchronous remainder);
 * - channel mix volumes: alphaTab sets them from the Render tracks on `readyForPlayback`
 *   (placeholder channels of excluded tracks included); the hook's later listener resets them.
 */
export function attachPlaybackScore(
  api: HookTarget,
  playbackFor: (render: Score) => Score | undefined,
): { stats: HookStats; detach: () => void } {
  const stats: HookStats = { midiLoads: 0, rewritten: 0, failures: [] };
  let current: Score | undefined;
  const applyVolumes = () => {
    const player = api.player;
    if (!player || !current) return;
    for (const [channel, volume] of channelVolumes(current.tracks))
      player.setChannelVolume(channel, volume);
  };
  const offLoad = api.midiLoad.on((file) => {
    stats.midiLoads++;
    const render = api.score;
    const playback = render ? playbackFor(render) : undefined;
    if (!playback) {
      stats.failures.push('no Playback Score for the rendered Score: MIDI emptied');
      file.tracks.splice(0, file.tracks.length);
      current = undefined;
      return;
    }
    const result = rewriteMidiFile(file, playback, api.settings);
    stats.rewritten++;
    stats.lastTickShift = result.tickShift;
    stats.lastNaturalTickShift = result.naturalTickShift;
    current = playback;
    queueMicrotask(() => {
      api.player?.applyTranspositionPitches(result.transpositionPitches);
      applyVolumes();
    });
  });
  const offReady = api.playerReady.on(applyVolumes);
  return {
    stats,
    detach: () => {
      offLoad();
      offReady();
    },
  };
}
