// Spike S7: Render/Playback Score pairs for the experiment (Node only).
//
// The approved Q-C policy excludes a track only from the 16th melodic track on, so a 3-track
// document never has an excluded track. E3 and E3-grace therefore take the real plan of a 3-track
// document and mark one track as excluded, with the placeholder the real policy produces for an
// excluded track (melodic channel index 15 → channel 0, the channel of the first melodic track).
// E16 uses the real policy unchanged. The Scores are built by the S2 Strategy A adapter.
import type { Beat, MhdDocument, Track } from '@musichub/music-model';
import {
  FIRST_BAR,
  bar,
  beat,
  d,
  documentOf,
  idSource,
  rest,
  staff,
  track,
  voice,
} from '../builders.ts';
import {
  allocateChannels,
  applyChannels,
  playbackDocument,
  type ChannelPlan,
} from '../channels.ts';
import type { IdMap } from '../id-map.ts';
import { newSettings } from '../run.ts';
import { asPlaybackScore, asRenderScore, type PlaybackScore, type RenderScore } from '../scores.ts';
import { toAlphaTabDirect } from '../strategy-a.ts';

export interface VariantPair {
  name: 'E3' | 'E3-grace' | 'E16';
  doc: MhdDocument;
  plan: ChannelPlan;
  render: RenderScore;
  playback: PlaybackScore;
  renderIdMap: IdMap;
  playbackIdMap: IdMap;
  /** MHD ids of the tracks left out of the Playback Score. */
  excluded: string[];
}

type Id = () => string;
const quarter = (id: Id, pitch: number) => beat(id, d(4), [{ pitch }]);
const bars = (id: Id, perBar: (Beat[] | null)[]) =>
  perBar.map((beats) => bar(id, [voice(id, beats ?? [rest(id, d(1))])]));

/**
 * E3: piano A plays bar 1, bass C plays bar 2, strings B (excluded, volume 0.3) both bars with
 * keys no other track uses. Distinct keys per track make every played note attributable.
 */
export function e3Document(grace = false): MhdDocument {
  const id = idSource('S7');
  const a = [60, 62, 64, 65].map((p) => quarter(id, p));
  const c = [40, 43, 45, 47].map((p) => quarter(id, p));
  const b1 = [84, 86, 88, 89].map((p) => quarter(id, p));
  const b2 = [91, 93, 95, 96].map((p) => quarter(id, p));
  if (grace) b1.unshift(beat(id, d(16), [{ pitch: 83 }], { grace: 'beforeBeat' }));
  const masterBars = [FIRST_BAR, {}];
  const tracks: Track[] = [
    track(id, 'A piano', { family: 'piano', midiProgram: 0, percussion: false }, [
      staff(id, bars(id, [a, null])),
    ]),
    track(
      id,
      'B strings',
      { family: 'strings', midiProgram: 48, percussion: false },
      [staff(id, bars(id, [b1, b2]))],
      { mixer: { volume: 0.3, pan: 0, mute: false, solo: false } },
    ),
    track(id, 'C bass', { family: 'bass', midiProgram: 33, percussion: false }, [
      staff(id, bars(id, [null, c])),
    ]),
  ];
  return documentOf(
    '01900000-0000-7000-8000-0000000000e3',
    grace ? 'S7 E3-grace' : 'S7 E3',
    masterBars,
    tracks,
    id,
  );
}

/** E16-style document: 16 melodic tracks with distinct programs; the 16th is excluded by Q-C. */
export function e16Document(): MhdDocument {
  const id = idSource('S7');
  const tracks = Array.from({ length: 16 }, (_, i) =>
    track(
      id,
      `T${i + 1}`,
      { family: 'piano', midiProgram: i, percussion: false },
      [
        staff(
          id,
          bars(id, [[quarter(id, 40 + i), quarter(id, 40 + i)].concat([rest(id, d(2))]), null]),
        ),
      ],
      i === 15 ? { mixer: { volume: 0.3, pan: 0, mute: false, solo: false } } : {},
    ),
  );
  return documentOf('01900000-0000-7000-8000-000000000016', 'S7 E16', [FIRST_BAR, {}], tracks, id);
}

/** Marks `excludedId` as excluded with the real policy's placeholder (channel 0). */
function excludeTrack(plan: ChannelPlan, excludedId: string): ChannelPlan {
  return {
    ...plan,
    tracks: plan.tracks.map((t) =>
      t.trackId === excludedId ? { ...t, render: { primary: 0, secondary: 0 }, playback: null } : t,
    ),
  };
}

function e3Pair(name: 'E3' | 'E3-grace'): VariantPair {
  const doc = e3Document(name === 'E3-grace');
  const excludedId = doc.tracks[1]?.id;
  if (!excludedId) throw new Error('E3 has three tracks');
  const plan = excludeTrack(allocateChannels(doc), excludedId);
  const full = toAlphaTabDirect(doc, newSettings());
  applyChannels(full.renderScore, doc.tracks, plan, 'render');
  const pdoc = playbackDocument(doc, plan);
  const sub = toAlphaTabDirect(pdoc, newSettings());
  // `sub` allocated its own channels for two tracks; write the three-track plan's channels.
  applyChannels(sub.playbackScore, pdoc.tracks, plan, 'playback');
  return {
    name,
    doc,
    plan,
    render: asRenderScore(full.renderScore),
    playback: asPlaybackScore(sub.playbackScore),
    renderIdMap: full.idMap,
    playbackIdMap: sub.playbackIdMap,
    excluded: [excludedId],
  };
}

function e16Pair(): VariantPair {
  const doc = e16Document();
  const a = toAlphaTabDirect(doc, newSettings());
  return {
    name: 'E16',
    doc,
    plan: a.channels,
    render: a.renderScore,
    playback: a.playbackScore,
    renderIdMap: a.idMap,
    playbackIdMap: a.playbackIdMap,
    excluded: a.channels.tracks.filter((t) => !t.playback).map((t) => t.trackId),
  };
}

export function variantPairs(): VariantPair[] {
  return [e3Pair('E3'), e3Pair('E3-grace'), e16Pair()];
}
