# ADR-0002: Own canonical document model (MHD) instead of alphaTab Score/JSON

- **Status:** Accepted. Amended 2026-11-24 with the adapter strategy from spike S2 (ROADMAP.md S2-05), see [Amendment 1](#amendment-1-2026-11-24-alphatab-adapter-strategy-spike-s2-s2-05)
- **Date:** 2026-11-21
- **Deciders:** project owner
- **Spec sections:** MUSIC_ENGINE.md §1–4; ARCHITECTURE.md §1.2
- **Evidence:** [docs/spikes/s2-mhd-to-alphatab.md](../spikes/s2-mhd-to-alphatab.md)

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

The decision above is unchanged. Until this amendment the status read "Accepted (adapter strategy A vs B is finalised by spike S2 in Sprint 2)"; this amendment is that finalisation. It records the owner's decisions after spike S2 and its review: Q-A (strategy), Q-B (diagnostics), Q-C (playback channels, partly), Q-D (ottava) and Q-E (fermatas). Nothing here is implemented in production code yet; `packages/music-engine` is Phase 1 work. Spike code is never promoted as-is (spikes/README.md).

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

### A5. Playback channel allocation (Q-C, approved in part)

Approved:

- MIDI channel 9 (zero-based) is reserved for percussion; melodic tracks never use it.
- Each melodic instrument gets its own channel when possible.
- Program-change conflicts from accidental channel sharing between instruments are not allowed.
- When channels are insufficient, the adapter uses a deterministic fallback and reports an `engine-policy` diagnostic.
- Channel allocation is adapter policy, not part of MHD.

**Not decided yet** (the proposal from the S2-05 review is not approved):

1. Behaviour for melodic tracks beyond the available channels (alphaTab 1.9 has 16 channels; the MIDI port is ignored).
2. Whether secondary channels go first to tracks with bend, whammy or vibrato.
3. Several percussion tracks with different mixer settings sharing channel 9.
4. Whether mute or solo may change the allocation.
5. A separate channel policy for the future in-house MIDI output engine (`midi-engine`).

The spike does not implement the approved fallback: beyond 15 melodic tracks it reuses channels by track index without a diagnostic, and in a 25-track probe it gave the 25th melodic track channel 9, the percussion channel.

### A6. Consequences and Phase 1 verification

- `packages/music-engine` (Phase 1) implements A1–A5 with the full diagnostics contract (A2) and the regression suite (A1), including tests for the two A defects found in review: the missing registration of articulation id 59, and alternate endings 33+, which Strategy A silently corrupts through 32-bit shifts (MHD keeps endings 1–99; the adapter must report them, never truncate or corrupt them).
- To verify in Phase 1: conversion and rendering in the browser render worker; audible playback; GP7 and MIDI exports opened in third-party applications; timeline parity with alphaTab (grace timing, tuplet tick truncation; spike S5).
- Unresolved owner decisions that may affect the adapter: the remaining Q-C points (A5), left-hand fingering numbering, alternate endings above 8 (drawn without numbers), half-open hi-hat on GM 42 vs 46 and rimshot on GM 40, note velocity in alphaTab playback.
