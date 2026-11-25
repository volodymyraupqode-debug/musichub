# ADR-0002: Own canonical document model (MHD) instead of alphaTab Score/JSON

- **Status:** Accepted. Amended 2026-11-24 with the adapter strategy from spike S2 (ROADMAP.md S2-05), see [Amendment 1](#amendment-1-2026-11-24-alphatab-adapter-strategy-spike-s2-s2-05); amended again 2026-11-24 with the playback mechanism from spike S7 (ROADMAP.md S2-07), see [Amendment 2](#amendment-2-2026-11-24-playback-score-substitution-spike-s7-s2-07); edit-loop measurements from spike S3 (ROADMAP.md S2-10) and the S3 acceptance criterion recorded in [Amendment 3](#amendment-3-2026-11-24-edit-loop-latency-spike-s3-s2-10) (criterion A9; S3 not met, no fallback selected); findings of spikes S2, S4 and S5 and an index of all Phase 0 spike results in [Amendment 4](#amendment-4-2026-11-24-phase-0-spike-findings-s2-12--status-deferred) (findings only); owner decisions on the open S5 timeline semantics (D1, D2, half-open hi-hat key, [CONV]) recorded 2026-11-25 in [Amendment 5](#amendment-5-2026-11-25-s5-timeline-semantics-owner-decisions) (decisions A10–A15; the S5 parity criterion is not yet established); the owner's S3 disposition under Q0 Option C (gap placed in Phase 3, Phase 1 architecture constraint) recorded 2026-11-25 in [Amendment 6](#amendment-6-2026-11-25-s3-owner-disposition-q0-option-c) (decision A16; A9 unchanged, S3 not met)
- **Date:** 2026-11-21
- **Deciders:** project owner
- **Spec sections:** MUSIC_ENGINE.md §1–4; ARCHITECTURE.md §1.2
- **Evidence:** [docs/spikes/s2-mhd-to-alphatab.md](../spikes/s2-mhd-to-alphatab.md), [docs/spikes/s7-playback-score-variants.md](../spikes/s7-playback-score-variants.md), [docs/spikes/s3-edit-loop-latency.md](../spikes/s3-edit-loop-latency.md), [docs/spikes/s4-import-fidelity.md](../spikes/s4-import-fidelity.md), [docs/spikes/s5-timeline-parity.md](../spikes/s5-timeline-parity.md)

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
2. **Render Score timing.** The Playback MIDI is generated on the Render Score's tick shift, including the shift caused by before-beat grace notes of tracks excluded from playback. With its own tick shift the cursor would resolve wrong beats (S7 report §6, E3-grace). The Playback tracks must be a subset of the Render tracks with the same master bars; otherwise the hook fails closed.
3. **Fail closed.** When the hook has no Playback Score for the rendered Score, or cannot generate its MIDI on the Render time axis, it empties the MIDI and reports a failure. It never lets the Render Score's MIDI play, and never throws into alphaTab's MIDI load, which would leave the previous Score's MIDI in the player.
4. **Mute and solo** (and track volume) target Playback Score tracks, resolved by MHD id. An excluded track has no playback channel: its Render Score track is never passed to `changeTrackMute`, `changeTrackSolo` or `changeTrackVolume`, because its placeholder channel belongs to another track.
5. **Channel state after each MIDI load.** alphaTab sets channel mix volumes (on `readyForPlayback`) and transposition pitches (in `loadMidiForScore`) from the Render Score. The hook resets both from the Playback Score after every load.
6. **`exportAudio` bypasses the hook**: it regenerates MIDI from the Render Score without `midiLoad`. Audio export needs its own implementation path that uses the Playback Score.
7. **Replacing the Render Score** (a new Score object) reloads the MIDI and stops playback. Keeping the playback position across edits is spike S3 (ROADMAP S2-10).
8. **Fallback kept open.** If the hook proves unstable, the fallback in MUSIC_ENGINE.md §5.2 stays available: render the Playback Score as well, which hides excluded tracks from the notation. It is not implemented.

**Not verified by S7:** whether the sustain pedal is audible, and the hand split for one-hand practice (MUSIC_ENGINE.md §5.2); `exportAudio`, backing tracks, count-in, metronome, playback ranges and looping with the hook; the cost of generating MIDI twice per load. Manual browser verification by the owner passed with no issues observed (S7 report §8); browsers and covered steps were not specified, and it did not include the sustain pedal or the hand split.

## Amendment 3 (2026-11-24): edit-loop latency (spike S3, S2-10)

Records the measured numbers MUSIC_ENGINE.md §10 asks for and, in A9, the owner's decision on the S3 acceptance criterion. **No fallback is selected.** A1–A8 are unchanged. Evidence: [S3 report](../spikes/s3-edit-loop-latency.md).

**Historical measurements (collected before A9 was defined).** They were taken with the S3 spike's own method, not with A9: the RenderScheduler was not part of the interval, and the end point was the first animation frame after `renderFinished` (or the arrival of the rendered image of the edited bar), not a confirmed painted frame. Under A9 they are **lower bounds**, never evidence of compliance.

- Measured: the full edit loop of A1 + A7 (Strategy A conversion of the whole document into Render and Playback Score, `api.renderScore`, MIDI regeneration with the `midiLoad` hook) in Playwright Chromium and WebKit, headless, from the edit command to the next frame (median / p95): 8 bars × 4 tracks 16 / 22 ms (Chromium), 27 / 79 ms (WebKit); 50 × 8 84–98 / 147–185 ms (Chromium), 114–169 / 245–558 ms (WebKit); 300 × 8 535 / 726 ms (Chromium), 619 / 1312 ms (WebKit).
- The < 150 ms target is met for the small document only. On 300 × 8 none of the MUSIC_ENGINE.md §6 fallbacks (horizontal layout, render window, edited track only) nor decoupled MIDI reaches it; the best measured combination (render window + no MIDI regeneration) is 244 / 352 ms (Chromium). No fallback is selected.
- Bottlenecks: whole-document conversion on every edit, MIDI generated twice on the main thread (alphaTab's Render-Score MIDI and the A7 hook's Playback-Score MIDI), and worker layout of the full sheet.
- Player position: an edit during playback stops it (A8.7); restoring `tickPosition` after `midiLoaded` works within 1 tick.
- Environment as recorded in the raw artifacts (`spikes/s2-mhd-to-alphatab/data/edit-loop/`): host platform `darwin`, arch `x64`, Node v26.13.1; headless Playwright Chromium (user agent reports Chrome/159.0.8154.6; its platform text is Playwright's device emulation) and Playwright WebKit (user agent "Version/27.2"; Playwright's engine build, **not Safari**); `navigator.hardwareConcurrency` 6 (Chromium) and 8 (WebKit); viewport 1280 × 720. Firefox, Safari, mobile devices and other hardware were not measured. These runs are historical evidence only, not reference-environment results under A9.
- Not decided: whether to pursue unmeasured options for large scores (partial Render Score for the displayed bars, off-main-thread conversion, MIDI regeneration only on play).

### A9. Edit-loop latency acceptance criterion (S3, owner decision 2026-11-24)

Defines the "< 150 ms target" of MUSIC_ENGINE.md §10 (S3) and ROADMAP.md S2-10. It does not change how the historical measurements above were taken.

**Measurement interval**

- **Start:** receipt of a single-note edit command by the editor, before RenderScheduler processing.
- **End:** the first actually painted frame in which the edited notation is visible.
- **Single edits** are the primary acceptance scenario.
- **Typing bursts** are a separate scenario. Their measurements include the RenderScheduler's minimum 50 ms interval between renders and are never mixed with single-edit results.

**Performance target**

- **p95 below 150 ms**, from at least 100 measured single-note edits across at least 2 independent sessions per reference environment.
- Reported per scenario and environment: median, p95, maximum and sample count.

**Reference document**

- 300 master bars × 8 tracks: the existing S2 `performanceDocument(300)` fixture, page layout, alphaTab 1.9.0 defaults.
- All eight tracks need not fit inside the viewport at the same time. The exact visible-track and viewport configuration is recorded for every measurement.
- The edited note is inside the visible viewport, so that the first painted frame can be verified.

**Reference environments**

- The headless Playwright Chromium and WebKit results on the Intel Mac (above) are historical evidence only.
- A future pass claim names the tested browser versions and the hardware configuration. Playwright WebKit is never reported as Safari; no coverage is claimed for browsers, devices or hardware that were not measured.

**Playback position (separate requirement, unchanged)**

- After an edit during playback, the player position is restored. Existing evidence: restored within 1 tick; playback stops on every edit and does **not** resume automatically.

**MIDI readiness (separate metric)**

- The time until MIDI is ready after an edit is measured and reported. It is not part of the 150 ms notation-rendering interval.
- A fallback that defers MIDI regeneration documents when playback becomes available again.

**Fallback policy.** The alternative "or fallback selected" of the original S3 definition stays. S3 may be closed without meeting the 150 ms target only if all of the following hold:

1. the owner explicitly selects a specific fallback;
2. its latency is measured with the A9 methodology;
3. its trade-offs and remaining latency are documented;
4. the owner explicitly accepts those trade-offs and the remaining excess over 150 ms;
5. its implications for playback-position preservation and MIDI readiness are documented separately.

No fallback is selected. No measured fallback or combination has demonstrated the 150 ms target; the best measured combination (render window + no MIDI regeneration) exceeds it.

**Status (2026-11-24)**

- S3 target: **not met** for the 300 × 8 reference document.
- S3 overall: **partly done**. No fallback selected.
- The existing measurements establish the failure (they are lower bounds, and even the fastest measured edit with a visible edited bar exceeds 150 ms in every large-document variant). They cannot establish a future pass: they include neither RenderScheduler processing nor confirmation of the painted frame, and they do not meet the sample-size and environment requirements of A9.
- A future pass claim requires new measurements that include the scheduler, confirm the painted frame, and satisfy the sample-size and environment requirements above.

## Amendment 4 (2026-11-24): Phase 0 spike findings (S2-12) — status Deferred

Records the results of spikes S2, S4 and S5 that the amendments above did not yet hold, so that every Phase 0 spike result is recorded in an ADR (ROADMAP.md §Phase 0 *Exit*). **Findings only:** no decision is taken, A1–A9 are unchanged, no acceptance criterion is changed, and no missing evidence is inferred. Each figure is copied from the cited report.

### Spike S2 (ROADMAP S2-05): conversion performance

- Source: [S2 report](../spikes/s2-mhd-to-alphatab.md) §8 (`pnpm bench`, Node 26.13.1, alphaTab 1.9.0, 300 master bars × 8 tracks, 3 runs of 1 cold + 30 warm conversions; ranges are min–max over the runs, not confidence intervals).
- Warm median time to a finished Score: **Strategy A 55–63 ms**, Strategy B 105–121 ms (121–138 ms including B's id map). Warm p95: A 76–118 ms, B 174–200 ms.
- Rendering, measured separately (Node SVG, all 8 tracks, width 1300): cold 621–714 ms, warm median 397–501 ms (4 runs each). Node only, not a browser worker.
- Status: done (decision A1).

### Spike S5 (ROADMAP S2-06): timeline parity

- Source: [S5 report](../spikes/s5-timeline-parity.md) §5–§7.
- Golden scenarios: **17 of 19** reach 100 % exact note-on, note-off and tempo parity with alphaTab 1.9.0 `MidiFileGenerator` (183 note-ons in those 17). The other two are `repeat-end-after-repeat` (MHD and alphaTab disagree, **D1**) and `ending-closing-skipped` (undefined in MHD, **D2**). Totals over all 19: 194 exact, 5 pitch, 5 missing note-ons.
- S2-05 corpus (15 documents, 31,246 reference note-ons): 30,748 exact; 456 pitch, of which 454 are the half-open hi-hat (MHD GM key 42 vs alphaTab 46); 4 missing (D1/D2 order); 38 unsupported (constructs the prototype does not model). No timing, ordering, velocity, channel or extra-event mismatch.
- Status: done for every construct whose semantics MHD defines or leaves to the engine. **Open owner decisions, unchanged:** D1, D2, the half-open hi-hat key, the [CONV] conventions.

### Spike S4 (ROADMAP S2-09): import fidelity

- Source: [S4 report](../spikes/s4-import-fidelity.md) §2–§3, §6–§7.
- Corpus: **14 original, hand-authored MusicXML fixtures** (13 distinct contents plus one compressed `.mxl`; synthetic own work); **0 Guitar Pro files**.
- alphaTab 1.9.0 `MusicXmlImporter` against independently written intent: every exercised feature group matches, except three deviations: D.S. al Coda arrives as Dal Segno; spaces in part names become U+00A0; an unslashed grace with `steal-time-previous` arrives on-beat. MHD v1 cannot hold tenuto or slur (reported as conversion losses).
- alphaTab on both sides (spike converter, GP7 round trip): all 14 converted documents are valid MHD v1; the GP7 round trip keeps sounding pitch but makes non-guitar, non-percussion staves stringed. Not evidence of GP7/GP8 import fidelity.
- **Unavailable evidence:** GP3, GP4, GP5, GP6/GPX, GP7 and GP8 are not evaluated (no independent, legally usable fixtures, OQ2); public-domain MusicXML was not used. The absence of GP files is a test-data gap, not evidence about the GP importers.
- Status: **partly done**; the S4 criterion (20 public-domain/own GP3–8 + MusicXML files) is not met.

### Index of Phase 0 spike results

| Spike | ROADMAP | Status | Recorded in |
|---|---|---|---|
| S1 alphaTab under Turbopack | S2-04 | done | ADR-0004 (decision and limitations) |
| S2 MHD → alphaTab strategy | S2-05 | done | ADR-0002 A1–A6 (decisions), Amendment 4 (numbers) |
| S3 edit-loop latency | S2-10 | partly done: target not met on 300 × 8, no fallback selected | ADR-0002 Amendment 3 (numbers, criterion A9) |
| S4 import fidelity | S2-09 | partly done: GP3–GP8 not evaluated, criterion not met | ADR-0002 Amendment 4 (findings) |
| S5 timeline parity | S2-06 | done for defined semantics; D1, D2, half-open key, [CONV] open | ADR-0002 Amendment 4 (findings) |
| S6 audio clock accuracy | S2-08 | partly done: automated part only, criterion not verified | ADR-0004 Addendum (findings, Deferred) |
| S7 playback-score variants | S2-07 | done (ROADMAP); the sustain-pedal and hand-split questions of MUSIC_ENGINE.md §10 S7 were not covered ([S7 report](../spikes/s7-playback-score-variants.md) §1), so "one-hand practice audible correctly" has no evidence | ADR-0002 Amendment 2 (A7, A8) |


## Amendment 5 (2026-11-25): S5 timeline semantics (owner decisions)

The original decision, Amendments 1–4 and A1–A9 are unchanged; numbering continues from A9. On 2026-11-25 the owner approved the S5 decision package (ROADMAP.md §Phase 0, owner decision 4) for the questions that spike S5 left open ([S5 report](../spikes/s5-timeline-parity.md) §6–§7; findings in Amendment 4). The spike ran on 2026-11-24, before these decisions; its report, prototype ([`spikes/s2-mhd-to-alphatab/src/timeline/`](../../spikes/s2-mhd-to-alphatab/src/timeline/)), golden scenarios ([`scenarios.ts`](../../spikes/s2-mhd-to-alphatab/src/timeline/scenarios.ts)) and tests ([`timeline.test.ts`](../../spikes/s2-mhd-to-alphatab/src/timeline/timeline.test.ts)) are unchanged and describe the state at that time. Nothing here is implemented: `music-model` and `music-engine` are Phase 1 work.

**These decisions do not establish the S5 pass criterion** (MUSIC_ENGINE.md §10: 100 % note-on parity on fixtures). They define the semantics the Phase 1 timeline must reproduce; parity under them must still be shown by the Phase 1 timeline parity tests (ROADMAP.md §Phase 1 *Exit*).

### A10. D1 — repeat end after an earlier repeat (option D1-a, approved)

- **MHD rule kept:** MUSIC_ENGINE.md §3.3 invariant 7 stays as written: a `repeatEnd` without its own `repeatStart` repeats from the start of the piece or from the previous repeat end. For `|: 1 2 :| 3 4 :|` the MHD order is `0 1 2 1 2 3 4 3 4 5`.
- **Finding:** alphaTab 1.9.0 plays `0 1 2 1 2 3 4 1 2 1 2 3 4 5` (one repeat group from bar 1; scenario `repeat-end-after-repeat`, S5 report §6 row 2).
- **Adapter responsibility:** to reproduce the MHD order, the Playback Score built by `toAlphaTab` may set an implicit `repeatStart` on the bar after the previous repeat end. The Render Score is unchanged, so the notation shows no repeat sign the document does not have. This uses the Render Score / Playback Score separation of A5, A7 and A8.
- **Not verified:** whether alphaTab honours such an inserted start has not been tested. Phase 1 implements it and verifies it with a parity test against `MidiFileGenerator` (scenario `repeat-end-after-repeat`). If that test shows that alphaTab does not honour the implicit start, the result is reported to the owner; MHD semantics are not changed and options D1-b (adopt alphaTab's order) or D1-c (require an explicit `repeatStart`) are not chosen without a new owner decision.

### A11. D2 — closing bar skipped in a repeat pass (option D2-a, approved)

- **New MHD invariant** (MUSIC_ENGINE.md §3.3 invariant 14): in every pass before the final pass of a repeat, the pass must reach a played repeat end of that repeat's ending group. Each repeat has one closing bar, so its `alternateEndings`, if present, must list every pass from 1 to count − 1. `validateDocument` rejects documents that break it.
- **Example rejected:** `|: 1 |1. 2 :|(3×) |2.3. 3 | 4` (scenario `ending-closing-skipped`): on passes 2 and 3 the closing bar is not played.
- **alphaTab's behaviour is not adopted:** alphaTab repeats from the skipped closing bar (`0 1 2 1 1 3 4`, `Repeat.onClosing`; S5 report §6 row 3). The pattern has no MHD meaning; it is invalid.
- **Consequences:** the S2-05 fixture `repeats` contains the pattern and must be reviewed and adapted in a separately scoped Phase 1 task. Importers must report or normalise the structure; that behaviour is not specified here. Rejecting the pattern removes it from the parity denominator; it is no evidence of parity.

### A12. Half-open hi-hat — GM key 42 vs 46 (option H-a, approved)

- **MHD key kept:** the timeline reports the GM key stored in `Note.pitch` (MUSIC_ENGINE.md §3.2). A note with `pitch: 42` and `drumTechnique: 'halfOpen'` is reported as 42; the timeline never rewrites it to 46. The MHD distinction between 42 + `halfOpen` and 46 + `halfOpen` is preserved.
- **Accepted alphaTab limitation:** alphaTab 1.9.0 has one half-open articulation (92) that sounds as GM 46 and cannot distinguish 42 + `halfOpen` from 46 + `halfOpen` ([S2 report](../spikes/s2-mhd-to-alphatab.md) §5.3). Audio therefore plays 46 where the timeline reports 42 (454 note-ons in the S2-05 corpus, S5 report §6 row 1).
- **Parity tests:** the difference stays a documented exception (`pitch` category, `halfOpen`, reference key 46), as in the S5 corpus test today.
- **GP7 export risk (known, from the S2 report §5.3 and §9):** because alphaTab collapses both into one articulation, a GP7 export written from the alphaTab model cannot keep the distinction (risk "medium"; the report's mitigation "accept, or warn on export"). How the export reports it is not decided here; it belongs to the A2 diagnostics contract in Phase 1.

### A13. [CONV] rules 1–3 adopted as MHD semantics (approved)

Rules that the S5 prototype used and that match alphaTab 1.9.0 in every golden scenario that exercises them (S5 report §2, §4, §5.1) become normative MHD rules (MUSIC_ENGINE.md §3.2 *Repeats and navigation*):

1. After a D.C. or D.S. jump, repeats play only their final pass (scenarios `segno-with-repeat`, `combined`).
2. A jump inside a repeated section is taken on its last pass only (scenario `jump-inside-repeat`).
3. To Coda and Fine are ignored before the jump (scenarios `coda`, `da-capo-al-coda`, `combined` for To Coda; `da-capo-al-fine`, `segno-with-repeat` for Fine).

### A14. [CONV] rule 4 replaced by a validation limit (approved)

- **New MHD invariant** (MUSIC_ENGINE.md §3.3 invariant 15): a document contains at most one `segno` and at most one `coda` direction. `validateDocument` rejects more.
- With one marker of each, the spike's rule 4 (which segno D.S. uses, which coda To Coda uses) has a single answer. Behaviour with several segnos or codas is **not tested**: no golden scenario contains more than one, neither in the prototype nor against alphaTab. MHD claims no support for it.
- Relaxing the limit later needs its own semantic decision with tests against alphaTab.
- `segnoSegno` and `doubleCoda` are not affected: in MHD v1 they are markers that no direction jumps to (S5 report §6).

### A15. Default dynamic before the first marking (disposition, approved)

- **No MHD rule is added now.** MHD v1 does not define the dynamic before the first `Beat.dynamic`; the question stays **open** in the specification. The adapter's current assumption, *f* (Strategy A, S5 report §2 *Adapter convention*), is not an MHD rule.
- **Decision required in Phase 1**, during MHD v1 finalisation: whether *f* becomes the MHD default dynamic, or the default stays an adapter responsibility.
- **Velocity-parity implication:** alphaTab derives velocity from the dynamic (15 + 16 × dynamic, S5 report §2) and ignores `Note.velocity` (S2-05). The S5 velocity parity holds only because the prototype applies the same *f* default; MUSIC_ENGINE.md §3.2's `Note.velocity` "default from dynamic" is undefined before the first marking until this is decided.

### Phase 1 implementation and verification requirements

- D1: implement the implicit Playback Score `repeatStart` in `music-engine` and verify the MHD order against `MidiFileGenerator`; report a failure to the owner (A10).
- D2: implement invariant 14 in `validateDocument` with an issue code; review and adapt the S2-05 `repeats` fixture in a separately scoped task (A11).
- Half-open hi-hat: keep the timeline on the MHD key and keep the documented exception in the parity tests (A12).
- [CONV] 1–3: implement and test them in `music-model/timeline` (A13).
- [CONV] 4: implement invariant 15 with an issue code and test it (A14).
- Default dynamic: decide during MHD v1 finalisation (A15).
- The Phase 1 exit criterion "Timeline parity tests (S5) pass" applies under these rules. MHD v1 is unreleased, so these runtime invariants need no `schemaVersion` bump (MUSIC_ENGINE.md §3.4); they are not structural schema changes.

## Amendment 6 (2026-11-25): S3 owner disposition (Q0 Option C)

The original decision, Amendments 1–5 and A1–A15 are unchanged; numbering continues from A15. **A9 is unchanged**: its measurement interval, p95 < 150 ms target, sample and session requirements, reference document, reference-environment rules and fallback policy apply as written. This amendment records the owner's disposition of spike S3 required by the Q0 rule (ROADMAP.md §Phase 0, owner decision 2), selected from the S3 decision brief as **Option B + D**. Evidence: [S3 report](../spikes/s3-edit-loop-latency.md) and Amendment 3; both are historical and unchanged.

### A16. S3 disposition (owner decision 2026-11-25, approved)

> **S3 disposition (owner, 2026-11-25):** The S3 gap is placed in Phase 3 (Editor). ADR-0002 A9 remains unchanged; S3 remains technically not met. In Phase 3, with the real `editor-core` and RenderScheduler, the edit loop must be measured under A9 on the 300 × 8 reference document. S3 closes only through an A9 pass or an A9-compliant fallback explicitly selected and accepted by the owner.
>
> Phase 1's `toAlphaTab`, render-controller and Playback Score architecture must not preclude a partial Render Score, off-main-thread conversion, or MIDI regeneration on play.

**B — gap placed in Phase 3 (Editor).**

- **S3 remains technically not met.** The historical Playwright Chromium and WebKit measurements (Amendment 3) stay historical evidence and lower bounds under A9; none is an A9 pass, and no measured variant is a selected or accepted fallback. The best measured combination (render window + no MIDI regeneration, 244 / 352 ms Chromium, 255 / 339 ms Playwright WebKit, median / p95) exceeds the target. Playwright WebKit is not Safari.
- **Phase 3 owns the remaining S3 work** (ROADMAP.md §Phase 3): measure the real edit loop, with the real `editor-core` and RenderScheduler, under the unchanged A9 method on the 300 master bars × 8 tracks reference document (`performanceDocument(300)`), including typing bursts as A9's separate scenario; evaluate the unmeasured approaches below and/or an A9 fallback; report MIDI readiness and playback-position restoration separately from the 150 ms interval, as A9 requires.
- **Closure:** S3 closes only through an A9 pass, or through an A9-compliant fallback that the owner explicitly selects and accepts under A9's fallback policy (all five conditions). No pass claim is made without A9-compliant evidence.
- Under Q0 Option C this records S3's owner disposition (the gap is placed in a named later phase). It does not meet the S3 pass criterion of MUSIC_ENGINE.md §10.

**D — Phase 1 architecture constraint.**

- Phase 1's `toAlphaTab`, render controller and Playback Score design (A1, A5, A7, A8) must keep three approaches feasible for later evaluation: (1) partial Render Score conversion for the displayed bars, (2) off-main-thread conversion, (3) MIDI regeneration when playback starts instead of on every edit.
- These are **architectural options to keep feasible**, not approved implementations or proven optimisations. None has been measured, and no latency is claimed for any of them. Phase 1 does not have to implement them. Choosing one later needs its own measurement under A9 and, where it changes an approved decision, an ADR.
