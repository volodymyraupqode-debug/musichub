// Render Score vs Playback Score (owner decision on Q-C). The two are separate alphaTab Score
// objects with distinct compile-time brands, so a Render Score cannot be passed where a Playback
// Score is expected (e.g. `midiSummary`). The brand exists only in the type system; a cast is
// needed to create one, which keeps every creation point explicit.
//
// Whether alphaTab's player can play a Playback Score while showing a different Render Score is
// NOT verified here (spike S7). The spike generates MIDI from the Playback Score with
// MidiFileGenerator only.
import type * as alphaTab from '@coderline/alphatab';

declare const renderBrand: unique symbol;
declare const playbackBrand: unique symbol;

/** All MHD tracks, for notation. Channels of excluded tracks are placeholders: never play it. */
export type RenderScore = alphaTab.model.Score & { readonly [renderBrand]: true };
/** Only tracks with a conflict-free playback channel; the only Score MIDI may be generated from. */
export type PlaybackScore = alphaTab.model.Score & { readonly [playbackBrand]: true };

export const asRenderScore = (score: alphaTab.model.Score): RenderScore => score as RenderScore;
export const asPlaybackScore = (score: alphaTab.model.Score): PlaybackScore =>
  score as PlaybackScore;
