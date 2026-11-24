// MIDI channel allocation for the spike (decision Q-C, owner-approved policy with separate Render
// and Playback Scores). Channel allocation is adapter policy and never part of MHD.
//
// - Channel 9 (zero-based) is reserved for percussion; percussion tracks always use 9/9.
// - Melodic tracks use only MELODIC_CHANNELS (0–8, 10–15), allocated in document order; percussion
//   tracks do not count towards the melodic index.
// - Up to 7 melodic tracks: consecutive pairs (primary, secondary), as alphaTab's importers assign.
// - 8–15 melodic tracks: one own primary each; the remaining channels become secondaries in
//   document order; other tracks use their primary as secondary (existing spike behaviour, no
//   bend/whammy/vibrato prioritisation: that Q-C point is not decided).
// - From the 16th melodic track: share the channel of the earliest earlier melodic track with the
//   same MIDI program and bank; otherwise the track has no playback channel and is left out of the
//   Playback Score (engine-policy warning). It stays in the Render Score with a placeholder channel
//   that must never be used for playback.
import type * as alphaTab from '@coderline/alphatab';
import type { MhdDocument, Track } from '@musichub/music-model';
import type { Loss } from './losses.ts';

export const PERCUSSION_CHANNEL = 9;
export const MELODIC_CHANNELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15] as const;

export interface ChannelPair {
  primary: number;
  secondary: number;
}

export interface TrackChannels {
  trackId: string;
  percussion: boolean;
  /** Channels written into the Render Score. For excluded tracks a placeholder, never played. */
  render: ChannelPair;
  /** Conflict-free playback channels, or null: the track is not in the Playback Score. */
  playback: ChannelPair | null;
  /** Id of the earlier track whose channel is shared (same program and bank), if any. */
  sharesWith?: string;
}

export interface ChannelPlan {
  tracks: TrackChannels[];
  /** engine-policy diagnostics: warnings for excluded tracks, info for permitted sharing. */
  diagnostics: Loss[];
}

function melodicChannel(index: number): number {
  const channel = MELODIC_CHANNELS[index % MELODIC_CHANNELS.length];
  if (channel === undefined) throw new Error('unreachable: melodic channel index out of range');
  return channel;
}

const sameInstrument = (a: Track, b: Track): boolean =>
  a.instrument.midiProgram === b.instrument.midiProgram &&
  (a.instrument.bank ?? 0) === (b.instrument.bank ?? 0);

export function allocateChannels(doc: MhdDocument): ChannelPlan {
  const melodic = doc.tracks.filter((t) => !t.instrument.percussion);
  const pairs = melodic.length * 2 <= MELODIC_CHANNELS.length;
  const spareSecondaries = pairs ? [] : MELODIC_CHANNELS.slice(melodic.length);
  const diagnostics: Loss[] = [];
  /** Melodic tracks that received a playback channel, in document order. */
  const playable: { track: Track; channels: ChannelPair }[] = [];
  let melodicIndex = 0;

  const tracks = doc.tracks.map((track): TrackChannels => {
    if (track.instrument.percussion) {
      const nine = { primary: PERCUSSION_CHANNEL, secondary: PERCUSSION_CHANNEL };
      return { trackId: track.id, percussion: true, render: nine, playback: nine };
    }
    const k = melodicIndex++;
    if (pairs) {
      const channels = { primary: melodicChannel(2 * k), secondary: melodicChannel(2 * k + 1) };
      playable.push({ track, channels });
      return { trackId: track.id, percussion: false, render: channels, playback: channels };
    }
    if (k < MELODIC_CHANNELS.length) {
      const primary = melodicChannel(k);
      const channels = { primary, secondary: spareSecondaries.shift() ?? primary };
      playable.push({ track, channels });
      return { trackId: track.id, percussion: false, render: channels, playback: channels };
    }
    const compatible = playable.find((p) => sameInstrument(p.track, track));
    const program = `program ${track.instrument.midiProgram}, bank ${track.instrument.bank ?? 0}`;
    if (compatible) {
      // Same program and bank: no program conflict. Volume, pan, mute and solo are per channel.
      const channels = { ...compatible.channels };
      playable.push({ track, channels });
      diagnostics.push({
        feature: 'track.playbackChannel',
        id: track.id,
        detail: `all 15 melodic MIDI channels are in use; shares channel ${channels.primary} with track ${compatible.track.id} (same ${program}), so volume, pan, mute and solo of that channel are shared`,
        code: 'engine-policy',
        severity: 'info',
        aspect: 'playback',
      });
      return {
        trackId: track.id,
        percussion: false,
        render: channels,
        playback: channels,
        sharesWith: compatible.track.id,
      };
    }
    diagnostics.push({
      feature: 'track.playbackChannel',
      id: track.id,
      detail: `playback unavailable: all 15 melodic MIDI channels are in use and none has ${program}; the track is left out of the Playback Score and stays in the Render Score`,
      code: 'engine-policy',
      severity: 'warning',
      aspect: 'playback',
    });
    // Placeholder for the Render Score only (resolved through the melodic list, never channel 9).
    const placeholder = melodicChannel(k);
    return {
      trackId: track.id,
      percussion: false,
      render: { primary: placeholder, secondary: placeholder },
      playback: null,
    };
  });
  return { tracks, diagnostics };
}

/** MHD document with only the tracks that have a playback channel (input of the Playback Score). */
export function playbackDocument(doc: MhdDocument, plan: ChannelPlan): MhdDocument {
  const playableIds = new Set(plan.tracks.filter((t) => t.playback).map((t) => t.trackId));
  return { ...doc, tracks: doc.tracks.filter((t) => playableIds.has(t.id)) };
}

/**
 * Writes the plan into a Score whose tracks are the MHD tracks of `tracks`, in order. `which`
 * selects render channels (placeholders allowed) or playback channels (every track must have one).
 */
export function applyChannels(
  score: alphaTab.model.Score,
  tracks: readonly Track[],
  plan: ChannelPlan,
  which: 'render' | 'playback',
): void {
  const byId = new Map(plan.tracks.map((t) => [t.trackId, t]));
  tracks.forEach((mhd, index) => {
    const entry = byId.get(mhd.id);
    const channels = which === 'render' ? entry?.render : entry?.playback;
    const track = score.tracks[index];
    if (!channels || !track) throw new Error(`no ${which} channels for track ${mhd.id}`);
    track.playbackInfo.primaryChannel = channels.primary;
    track.playbackInfo.secondaryChannel = channels.secondary;
  });
}
