# ADR-0002: Own canonical document model (MHD) instead of alphaTab Score/JSON

- **Status:** Accepted. Amended 2026-11-24 with the adapter strategy from spike S2 (ROADMAP.md S2-05), see [Amendment 1](#amendment-1-2026-11-24-alphatab-adapter-strategy-spike-s2-s2-05); amended again 2026-11-24 with the playback mechanism from spike S7 (ROADMAP.md S2-07), see [Amendment 2](#amendment-2-2026-11-24-playback-score-substitution-spike-s7-s2-07)
- **Date:** 2026-11-21
- **Deciders:** project owner
- **Spec sections:** MUSIC_ENGINE.md §1–4; ARCHITECTURE.md §1.2
- **Evidence:** [docs/spikes/s2-mhd-to-alphatab.md](../spikes/s2-mhd-to-alphatab.md), [docs/spikes/s7-playback-score-variants.md](../spikes/s7-playback-score-variants.md)

## Context

alphaTab is a rendering/playback SDK, not an editor. Its docs warn that direct model mutation can break rendering, and `JsonConverter` output is generated and unversioned.

## Decision

- Persist only the MusicHub Document (MHD), versioned via `schemaVersion` with migrations (`packages/music-model`).
- alphaTab is an adapter in `packages/music-engine` only: a fresh `Score` is built per change and `finish()` is called; alphaTab objects and IDs are never persisted.

## Consequences

- We own the editor, IDs, undo/redo and serialization. Import/export needs a coverage matrix and round-trip tests.

## Alternatives considered

- Persisting alphaTab JSON: rejected (no stability guarantee).
- Mutating alphaTab's Score as the editing model: rejected (documented as unsafe).

## Amendment 1 (2026-11-24): alphaTab adapter strategy (spike S2, S2-05)

The decision above is unchanged. Until this amendment the status read "Accepted (adapter strategy A vs B is finalised by spike S2 in Sprint 2)"; this amendment is that finalisation. It records the owner's decisions after spike S2 and its review: Q-A (strategy), Q-B (diagnostics), Q-C (playback channels; open questions listed in A5), Q-D (ottava) and Q-E (fermatas). Nothing here is implemented in production code yet; `packages/music-engine` is Phase 1 work. Spike code is never promoted as-is (spikes/README.md).

### A1. Adapter strategy (Q-A, approved)

- **Strategy A, direct construction, is the chosen direction for the production adapter** (`toAlphaTab()` in `music-engine`): build `Score`, `MasterBar`, `Track`, `Staff`, `Bar`, `Voice`, `Beat` and `Note` objects with the alphaTab model API and call `score.finish(settings)` once after construction.
- **Strategy B, alphaTex generation plus `ScoreLoader.loadAlphaTex`, is kept only as a test-only regression oracle.** It is never a production dependency. Phase 1 re-implements it in `music-engine` test support; the spike package itself is not moved.
- **B is not a fully independent oracle.** In the spike it shares the value-mapping tables and some conversion logic with A (`mapping.ts`: enums, units, percussion articulations, fermata placement). Agreement between A and B checks how each one builds the alphaTab model, not whether the mapping decisions are right. Mapping semantics need their own tests against MHD.
- **The Phase 1 regression support compares complete serialized alphaTab models** (`JsonConverter.scoreToJsObject`, alphaTab id references excluded), not only summarised facts. In S2 only the full comparison found the missing registration of articulation id 59 in A.
- **Fresh Score per conversion.** Every conversion creates a new `Score`; a rendered Score is never mutated.
- **ID map per Score.** The adapter returns a map MHD id ↔ alphaTab object (MUSIC_ENGINE.md §4.1). It is valid only for the Score it was built with and is never cached or reused across Score instances. alphaTab's own ids (`Bar.id`, `Beat.id`, `Note.id`, …) are global counters that alphaTex imports reset, so they are never keys.
- **alphaTab objects are transient adapter output** and never become persisted MHD data. MHD stays the source of truth for document semantics and ids.
- **The adapter owns** alphaTab-specific units (ticks, display transposition, string numbering), the percussion articulation mapping and the playback-channel allocation (A5). None of these are stored in MHD.
- **`validateDocument` gates conversion** in the production implementation: an invalid document is never converted. Both spike strategies accept some invalid input silently (overfull or missing bars, strings out of range in A) when the gate is bypassed.
- **alphaTab upgrades** must pass a regression suite that covers the construction assumptions found in S2: equal voice count per staff with placeholder voices, percussion staff tuning and drum-tab strings, complete articulation registration, global id reset on import, grace and tuplet tick rules, sustain pedal and fermata absent from MIDI, display transposition, the alternate-endings bitmask, and the GP7 round trip.

### A2. Conversion diagnostics (Q-B, approved direction)

- Conversion never silently rewrites or simplifies MHD to suit alphaTab.
- Every unsupported, approximated, ignored or limited feature is reported as a diagnostic.
- An invalid document or a critical conversion failure does not produce a successful result.
- Intended Phase 1 result shape:
  - success: `Score`, ID map and diagnostics;
  - failure: diagnostics only, no `Score`.
- Proposed diagnostic fields: `code`, `severity` (`info` | `warning` | `error`), `aspect` (`notation` | `playback` | `export` | `all`), `feature` (schema-level MHD path such as `note.velocity`), `mhdIds` and `detail`. Codes: `invalid-document`, `unsupported`, `approximated`, `render-limited`, `playback-ignored`, `engine-policy`, `extension-ignored`.

**Status of the spike:** the S2 spike `Loss` structure is only a partial mapping of this contract. It has a single `id` instead of `mhdIds`, and `code`, `severity` and `aspect` are optional; only the fermata checks set them. The complete contract is not implemented anywhere yet.

**Known contract gaps to close in Phase 1:**

1. Required structured fields (`code`, `severity`, `aspect`) at every emission site.
2. Several affected MHD ids per diagnostic (`mhdIds`).
3. A structured location for elements without their own id, such as an individual fermata (today two failing fermatas in one bar carry the same master-bar id and differ only in `detail`).
4. Propagation of validation warnings (e.g. `ottava-not-displayed`, `fermata-not-on-beat`) into conversion diagnostics; the spike adapters emit nothing for an ottava that cannot be shown.
5. A more expressive impact representation when one feature affects several outputs (an unplaced fermata is missing from notation and from GP7/alphaTex exports; a single `aspect` cannot express that).

### A3. Ottava (Q-D, approved)

- `Bar.ottava` keeps its enum: `15ma` | `8va` | `8vb` | `15mb`.
- It is an octave line over every beat of every voice of the current bar on that staff only, and it does not carry into the next bar.
- `Note.pitch` (and the pitch derived from string and fret) stays the sounding pitch and is never modified.
- The alphaTab mapping uses `Beat.ottava` on every beat of the bar, grace beats included, never `Bar.clefOttava`.
- In alphaTab 1.9.0 `Beat.ottava` is display-only: `MidiFileGenerator` never reads it, so MIDI note events are unchanged (verified by spike tests). alphaTab does not implement any ottava playback transposition, and none is needed because the stored pitch is the sounding pitch.
- Validator warning `ottava-not-displayed` when the octave line cannot be shown: on a percussion track or a staff with `display.standard: false`.

### A4. Fermatas (Q-E, approved)

- `MasterBar.fermatas?: Fermata[]` replaces the former boolean `fermata`. `Fermata` = `{ position: Position; type?: 'short' | 'long' }`; an omitted type is a standard (medium) fermata.
- Fermatas belong to the master bar and apply to every track and staff at their position. Several fermatas per bar are allowed; positions strictly increase (invariant 11, `positions-not-increasing`).
- `position` is a reduced fraction of the nominal bar length of the time signature, the same coordinate system as tempo and pedal positions, also in a pickup bar.
- Validator warning `fermata-not-on-beat` when no non-grace beat (rests count) of any voice, staff or track starts at the position.
- MHD stores no duration multiplier or playback policy. Fermata playback is owned by the future timeline / playback engine; alphaTab 1.9's MIDI generator does not hold fermatas.
- alphaTab draws a fermata only on a beat that starts exactly at its tick. The adapter never rounds, moves or approximates a fermata. If the position is not a whole alphaTab tick, or no non-grace beat starts there, no alphaTab fermata is created and the spike reports `unsupported` (severity `warning`, aspect `notation`); the MHD position is unchanged. Strategies A and B report identical diagnostics.

### A5. Playback channel allocation (Q-C)

**Approved decisions:**

- **Two Scores per conversion.** The adapter produces a **Render Score** and a **Playback Score**.
  - The Render Score contains every MHD track (melodic and percussion) and is used for notation and hit-testing.
  - The Playback Score contains only tracks with a conflict-free channel allocation. **Only the Playback Score may be the source of MIDI playback; the Render Score must never enter the MIDI playback pipeline.**
- MIDI channel 9 (zero-based) is reserved for percussion; percussion tracks use 9 for both primary and secondary channel. Melodic tracks use only channels 0–8 and 10–15 and never channel 9.
- Each melodic track gets its own channel whenever one is available, allocated deterministically in document order; percussion tracks do not count toward the melodic index.
- When the melodic channels run out, a track may share a channel only with an earlier track that has the **same MIDI program and bank**, choosing the earliest compatible channel. Sharing between different programs or banks is never allowed.
- If no compatible channel exists, the track is **left out of the Playback Score and stays in the Render Score**, with an `engine-policy` warning that carries the track's MHD id. MHD is not changed.
- Channel allocation is adapter policy, not part of the canonical MHD model.

**Implemented in the spike** (PR #12, `spikes/s2-mhd-to-alphatab/src/channels.ts`, `scores.ts`; evidence in the [S2-05 report](../spikes/s2-mhd-to-alphatab.md), §5.4.1):

- Up to 7 melodic tracks get consecutive channel pairs (primary, secondary); 8–15 get one own primary each and the spare channels as secondaries in document order; from the 16th, the sharing and exclusion rules above apply. Sharing is reported as an `engine-policy` diagnostic with severity `info`.
- `RenderScore` and `PlaybackScore` are distinct compile-time types; the spike's MIDI helper accepts only a `PlaybackScore`. Each Score has its own ID map.
- Tracks excluded from playback keep a placeholder channel in the Render Score; it is never a playback allocation.
- Strategy B (test-only oracle) imports both Scores and normalises their channels to the same plan, because alphaTex has no channel syntax and alphaTab 1.9.0's importer does not follow this policy (melodic channel 9 from five melodic tracks, channels above 15 from nine).

**Open questions** (not decided; nothing above answers them):

1. S7: whether alphaTab's player can play a separate Playback Score while the Render Score is displayed is not proven. *Answered by Amendment 2 (A7): not natively; through the `midiLoad` hook, with the constraints of A8.*
2. GP7 export from the Render Score can contain placeholder channels; no export policy is approved.
3. Priority of secondary channels for bend, whammy and vibrato.
4. Mixer settings when several percussion tracks share channel 9.
5. Mute and solo for tracks that share a MIDI channel.
6. The channel policy of the future in-house MIDI output engine (`midi-engine`).
7. The performance cost of building two Scores per conversion is not measured.

### A6. Consequences and Phase 1 verification

- `packages/music-engine` (Phase 1) implements A1–A5 with the full diagnostics contract (A2) and the regression suite (A1), including tests for the two A defects found in review: the missing registration of articulation id 59, and alternate endings 33+, which Strategy A silently corrupts through 32-bit shifts (MHD keeps endings 1–99; the adapter must report them, never truncate or corrupt them).
- To verify in Phase 1: conversion and rendering in the browser render worker; audible playback; GP7 and MIDI exports opened in third-party applications; timeline parity with alphaTab (grace timing, tuplet tick truncation; spike S5).
- Unresolved owner decisions that may affect the adapter: the open questions of A5, left-hand fingering numbering, alternate endings above 8 (drawn without numbers), half-open hi-hat on GM 42 vs 46 and rimshot on GM 40, note velocity in alphaTab playback.

## Amendment 2 (2026-11-24): Playback Score substitution (spike S7, S2-07)

Amendment 1 and its decisions A1–A6 are unchanged. This amendment answers open question 1 of A5 with the owner's decision after spike S7 ([report](../spikes/s7-playback-score-variants.md)). Numbering continues from Amendment 1. Nothing here is implemented in production code; `packages/music-engine` is Phase 1 work.

### A7. Playback mechanism (approved)

- **The Render Score / Playback Score separation of A5 is retained.**
- alphaTab 1.9.0 has no API to play a Score other than the rendered one: every MIDI load generates MIDI from `api.score` (S7 report §3).
- The adapter substitutes the MIDI through alphaTab's public **`midiLoad`** event, in one isolated hook inside `packages/music-engine`. alphaTab fires the event synchronously with the `MidiFile` it passes to the player next. The hook replaces that file's content with MIDI generated from the Playback Score, while the Render Score keeps the time line: its tick lookup drives the cursor and beat events.
- **Evidence:** spike S7 Node tests (time axis, content, cursor beat coherence, offline mute/solo with alphaTab's synthesizer) and the real `AlphaTabApi` in Playwright Chromium and WebKit, including a control run without the hook (S7 report §6).

### A8. Constraints (approved with A7)

1. **Workaround.** Changing the `midiLoad` payload is not a documented alphaTab feature. The hook is tied to alphaTab 1.9.0 (pinned); every alphaTab upgrade re-runs the S7 evidence before it is accepted.
2. **Render Score timing.** The Playback MIDI is generated on the Render Score's tick shift, including the shift caused by before-beat grace notes of tracks excluded from playback. With its own tick shift the cursor would resolve wrong beats (S7 report §6, E3-grace). The Playback tracks must be a subset of the Render tracks with the same master bars; otherwise the hook fails.
3. **Mute and solo** (and track volume) target Playback Score tracks, resolved by MHD id. An excluded track has no playback channel: its Render Score track is never passed to `changeTrackMute`, `changeTrackSolo` or `changeTrackVolume`, because its placeholder channel belongs to another track.
4. **Channel state after each MIDI load.** alphaTab sets channel mix volumes (on `readyForPlayback`) and transposition pitches (in `loadMidiForScore`) from the Render Score. The hook resets both from the Playback Score after every load.
5. **`exportAudio` bypasses the hook**: it regenerates MIDI from the Render Score without `midiLoad`. Audio export needs its own implementation path that uses the Playback Score.
6. **Replacing the Render Score** (a new Score object) reloads the MIDI and stops playback. Keeping the playback position across edits is spike S3 (ROADMAP S2-10).
7. **Fallback kept open.** If the hook proves unstable, the fallback in MUSIC_ENGINE.md §5.2 stays available: render the Playback Score as well, which hides excluded tracks from the notation. It is not implemented.

**Not verified by S7:** whether the sustain pedal is audible, and the hand split for one-hand practice (MUSIC_ENGINE.md §5.2); `exportAudio`, backing tracks, count-in, metronome, playback ranges and looping with the hook; the cost of generating MIDI twice per load. The owner reports having run the S7 manual browser and audio checklist; its individual results are not recorded yet (S7 report §8).
