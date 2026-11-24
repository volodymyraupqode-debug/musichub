# Spike S7 — Playback-score variants (ROADMAP S2-07)

> Status: done. Owner decision (2026‑11‑24): keep the `midiLoad` hook (ADR-0002 Amendment 2,
> A7–A8). Manual verification by the owner: passed (§8). Isolated spike in `spikes/s2-mhd-to-alphatab`
> (`src/playback-variants/`, `e2e/`). alphaTab 1.9.0 (pinned). Pass/fail criteria (§5) were
> written before the experiment ran. No production code, MHD, channel policy (Q-C) or S2-06 code
> was changed.

## 1. Question

ADR-0002 Amendment 1 (A5) separates a **Render Score** (all MHD tracks, for notation) from a
**Playback Score** (only tracks with a conflict-free channel; the only MIDI source). Its open
question 1 and MUSIC_ENGINE.md §10 S7 ask: can alphaTab's player play a Playback Score while
`AlphaTabApi` renders a different Render Score, with a coherent cursor, beat events, track
selection, mute/solo and tempo, and what happens when the Render Score is replaced?

Not covered here (also part of MUSIC_ENGINE.md §10 S7): whether the sustain pedal is audible, and
the hand split for one-hand practice (§5.2). They need their own experiment.

## 2. Answer in short

- **Natively: no.** alphaTab 1.9.0 has no API or setting to play a Score other than `api.score`
  (§3). Every automatic MIDI load generates MIDI from the rendered Score.
- **Through the public `midiLoad` event: yes, in this experiment.** alphaTab fires `midiLoad`
  synchronously with the `MidiFile` object it hands to the player right after. A hook that
  replaces the file's tracks with the Playback Score's MIDI (on the Render Score's tick shift)
  passed all criteria: time axis, content, cursor/beat coherence, mute/solo at audio level (Node,
  offline synthesis), and the real `AlphaTabApi` in Playwright Chromium and WebKit, including a
  Render Score replaced during playback.
- **The hook is a workaround with a contract alphaTab does not document.** The `midiLoad`
  documentation describes reading the file, not changing it. Three side effects come from the
  Render Score and must be corrected or avoided (§7): channel mix volumes, transposition pitches,
  and any API that takes tracks (`changeTrackMute/Solo/Volume`, `exportAudio`).

## 3. Source evidence (alphaTab 1.9.0)

Paths are relative to `node_modules/@coderline/alphatab/dist/`. Line numbers refer to
`alphaTab.core.mjs` unless stated.

| What | Where | Finding |
|---|---|---|
| `AlphaTabApiBase.renderScore(score, trackIndexes)` | 50707 | Without `trackIndexes` only the first track is rendered; `[-1]` renders all |
| `_internalRenderTracks` | 50761–50787 | A new Score (`score !== this.score`) sets `_score`, resets `_tickCache`, calls `_onScoreLoaded` and `loadMidiForScore()` (before or after `render()`, `_canRenderBeforeMidi` 53005). The same Score with other tracks only re-renders: no MIDI reload |
| `loadMidiForScore()` | 51649–51670 | Always `const score = this.score`; `MidiFileGenerator(score, this.settings, handler)`; `_tickCache = generator.tickLookup`; **`_onMidiLoad(midiFile)` before** `player.midiTickShift = handler.tickShift`, `player.loadMidiFile(midiFile)`, `loadBackingTrack(score)`, `updateSyncPoints(...)`, `applyTranspositionPitches(generator.transpositionPitches)` |
| `_onMidiLoad` / `midiLoad` | 53445–53450; `alphaTab.d.ts` 2698 | `midiLoad.trigger(e)` synchronously with the same `MidiFile`. Public event since 1.2.0 |
| `_setupPlayerWrapper` | 50495–50522 | `player.ready` → `loadMidiForScore()` (a second load when the worker is ready). `readyForPlayback` → `setChannelVolume(primary/secondary, volume / 16)` for **`this.tracks`**, the rendered tracks |
| `_setupOrDestroyPlayer` / `updateSettings` | 51609; 50608 | A player is recreated only when the player mode changes; otherwise `updateSettings()` does not reload the MIDI |
| `_cursorUpdateTick` / `_onPlayerPositionChanged` | 52121; 53586 | The cursor maps the player tick to a beat with `_tickCache`, the Render Score's tick lookup, so cursor and beat events are Render Score objects |
| `changeTrackVolume/Solo/Mute(tracks, …)` | 51715; 51754; 51792 | Use the passed tracks' `playbackInfo.primaryChannel/secondaryChannel`: a channel operation, whatever Score the tracks belong to |
| `exportAudio` | 53939 | Regenerates MIDI from `this.score` and never fires `midiLoad`: it bypasses the hook |
| `MidiFileGenerator.generate` / `_detectTickShift` | 47797; 47815 | The tick shift is the largest negative start of the first beats over **all** tracks |
| `buildTranspositionPitches` / `_generateChannel` | 47840; 47848 | Transposition per channel; from `settings.notation.transpositionPitches[track.index]` (track index) or `-staff.transpositionPitch` |
| `MidiFile.tickShift`, `tracks` | 33610; 33642 | `tracks` is read-only in the typings; the hook replaces its contents in place |

## 4. Setup and data flow

Pairs (`src/playback-variants/pairs.ts`), built by the S2 Strategy A adapter:

| Pair | Render Score | Playback Score | Excluded track |
|---|---|---|---|
| E3 | 3 tracks: A piano (bar 1), B strings (bars 1–2, volume 0.3), C bass (bar 2) | A, C | B |
| E3-grace | as E3; B starts with a before-beat grace note | A, C | B |
| E16 | 16 melodic tracks, distinct programs, real Q-C policy | tracks 1–15 | track 16 |

Under the approved Q-C policy a track is excluded only from the 16th melodic track on, so a
3-track document never excludes one. E3 and E3-grace therefore take the real plan of the 3-track
document and mark B as excluded with the placeholder the real policy produces (channel 0, the
first melodic track's channel: `melodicChannel(15)`). E16 shows the same collision under the
unchanged policy. Every track plays keys no other track uses, so each played note is
attributable.

Data flow with the hook (`src/playback-variants/hook.ts`):

```
api.renderScore(Render) ─▶ loadMidiForScore()
   MidiFileGenerator(Render) ─▶ MidiFile (Render MIDI), tickLookup ─▶ _tickCache (cursor)
   midiLoad(MidiFile) ─▶ hook: MidiFileGenerator(Playback) with the Render tick shift
                               ─▶ MidiFile.tracks := Playback MIDI tracks
   player.loadMidiFile(MidiFile)      ◀─ plays the Playback MIDI
   player.applyTranspositionPitches(Render map) ─▶ hook (microtask): Playback map
readyForPlayback ─▶ alphaTab: volumes from rendered tracks ─▶ hook (later listener): Playback volumes
```

Evidence runs in two places:

- **Node** (`src/playback-variants/variants.test.ts`, part of `pnpm test`): C2–C6 on the three
  pairs. It replays the `loadMidiForScore` steps with the same alphaTab classes. C6 uses alphaTab's
  own `AlphaSynth` with the bundled `sonivox.sf2` and a pull-driven `ISynthOutput`
  (`offline-synth.ts`), so audio energy is measured deterministically without a browser.
- **Browser** (`e2e/s7-browser.spec.ts`, `pnpm test:browser`, not in CI): the real `AlphaTabApi`
  with workers, the audio worklet and the SoundFont, in a plain HTML harness
  (`e2e/s7-harness.html`, served by `e2e/s7-server.ts`) that loads the hook with its types
  stripped by Node. A control run (`?hook=off`) shows what alphaTab plays without the hook.

## 5. Pass/fail criteria (defined before running)

Each criterion is checked on three pairs (§4): **E3** (3 render tracks, 2 playback tracks),
**E3-grace** (as E3, the excluded track starts with a before-beat grace note) and **E16** (16
melodic tracks with distinct programs under the real Q-C policy, the 16th track excluded). The
pair was first described as "E17 (17 melodic tracks)"; the document has 16 tracks, and the name
was corrected before the results were recorded. The criteria themselves are unchanged.

| Id | Criterion | Pass when |
|---|---|---|
| C1 | Native support | alphaTab 1.9.0 has a public API that plays a Score other than `api.score`. Answered from source; no test |
| C2 | Time axis | The MIDI the player receives after the hook and the MIDI alphaTab would generate from the Render Score have the same `tickShift`, the same tempo events (tick, BPM), the same sync points and the same end tick |
| C3 | Content | The MIDI the player receives equals the Playback Score's MIDI (same note-on/off events by tick, channel, key and velocity), with no event from the excluded track, and every event on the Playback Score channel of its MHD track |
| C4 | Cursor and beat coherence | For 100 % of the note-ons the player receives, the Render Score's tick lookup (used by the cursor) resolves a beat with the same MHD beat id as the Playback Score beat that produced the note |
| C5 | Channel side effects | After the hook's corrections, the channel mix volumes and transposition pitches the player gets equal those of the Playback Score. The uncorrected values are recorded as a finding |
| C6 | Mute and solo (audio) | Offline synthesis with alphaTab's `AlphaSynth` and the bundled SoundFont: muting a Playback Score track silences it (energy ≤ 1 % of the unmuted energy) without silencing the other track (≥ 50 %); solo keeps only the solo track. A mute through the Render Score track is recorded as a finding |
| B1 | Browser: load | Real `AlphaTabApi` (Chromium, WebKit): after `renderScore(Render)` every `midiLoad` is rewritten by the hook, `api.score` is the Render Score, and no page error occurs |
| B2 | Browser: playback | Played note-ons (`midiEventsPlayed`) are exactly the Playback Score's keys and channels; no key of the excluded track is played; every `playedBeatChanged` beat belongs to the Render Score |
| B3 | Browser: track selection | `renderScore(sameRender, subset)` re-renders without a new `midiLoad`; the played MIDI stays the Playback Score's |
| B4 | Browser: Render Score replaced during playback | A new Render Score passed to `renderScore` while playing triggers a new `midiLoad` that the hook rewrites with the new Playback Score; afterwards the new pair plays with B2 holding |

A criterion that cannot be measured in an environment (for example no audio clock in headless
WebKit) is reported as **not measured**, never as passed.

## 6. Results

| Id | E3 | E3-grace | E16 | Evidence |
|---|---|---|---|---|
| C1 | **no native API** | — | — | §3: `loadMidiForScore` always uses `this.score`; no setting or method takes a second Score |
| C2 | pass (shift 0) | pass (shift 120 kept) | pass (shift 0) | tempo events, sync points and end tick identical |
| C3 | pass: 8 of 16 note-ons kept | pass: 8 of 17 | pass: 30 of 32 | no excluded key; every event on its plan channel. Without the hook the excluded track plays on channel 0 (control) |
| C4 | pass 8/8 | pass 8/8 | pass 30/30 | same MHD beat id in the Render tick lookup |
| C5 | pass after correction | pass after correction | pass after correction | uncorrected: channel 0 mix volume 0.3125 (excluded track) instead of 0.8125 (track A) |
| C6 | pass | not run | not run | muting A: energy in bar 1 → 0.0000 (unmuted 765.8), bar 2 unchanged (1137.3); solo C keeps only C |
| B1 | pass in Chromium and WebKit | — | — | two `midiLoad` after the first render (render + player `ready`), both rewritten |
| B2 | pass in Chromium and WebKit | — | — | played (channel, key) set equals the Playback MIDI; all beats are Render Score beats |
| B3 | pass in Chromium and WebKit | — | — | `renderScore(E3, [0, 2])`: no new `midiLoad`; playback unchanged |
| B4 | pass in Chromium and WebKit (E3 → E16) | — | pass (as the new pair) | one synchronous `midiLoad`, rewritten with E16's Playback Score; the player **stops** (state paused, `stopped: true`) and must be started again |

Supporting findings, each with a test:

- **E3-grace:** the excluded grace note gives the Render Score a tick shift of 120; the Playback
  Score alone needs 0. With the Playback Score's own shift, note-ons resolve to wrong beats. The
  hook therefore generates the Playback MIDI on the Render shift.
- **Mute through the Render Score track** of the excluded track (placeholder channel 0) silences
  track A (C6 finding test).
- **Fail-closed:** without a Playback Score for the rendered Score the hook empties the MIDI and
  records a failure, so the Render MIDI never plays (test "hook without a Playback Score").
- **Control** (`?hook=off`, both browsers): alphaTab alone plays the excluded track's keys on
  channel 0, the first track's channel.

- **Fail-closed on a mismatched pair** (added in review): when the Playback Score needs a larger
  tick shift than the Render Score, the hook empties the MIDI and records a failure instead of
  throwing. A throw inside `midiLoad` would abort `loadMidiForScore` before
  `player.loadMidiFile`, and the player would keep the previous Score's MIDI.
- **No player calls after `detach()`** (added in review): a volume/transposition correction queued
  by a load just before `detach()` is dropped.

Validation (2026‑11‑24, agent): `pnpm turbo run lint typecheck test build` 21/21 tasks, spike
tests 576 passed and 4 skipped (23 of them S7); `pnpm test:browser` in the spike 4 passed
(Chromium, WebKit); `pnpm format:check` and `pnpm depcruise` clean. Manual check by the owner:
passed (§8).

## 7. Constraints for any adoption (from the evidence)

1. **Mute, solo and volume calls must use Playback Score tracks**, resolved from MHD ids. An
   excluded track has no playback channel: the UI must disable its mute/solo, and a call through
   its Render Score track would hit another track's channel.
2. **Channel mix volumes and transposition pitches are set from the Render Score** by alphaTab
   (`readyForPlayback`, `loadMidiForScore`) and must be reset from the Playback Score after each
   load, as the hook does. The adapter writes MHD transposition as display-only
   (`displayTranspositionPitch`), so all transposition values are 0 today; the correction runs
   but has not changed a value. `settings.notation.transpositionPitches` is indexed by track
   index, which differs between the two Scores: it must not be used.
3. **`exportAudio` bypasses `midiLoad`** and would export the Render Score's MIDI, including
   excluded tracks on placeholder channels. Not tested; any audio export needs its own path.
4. **Replacing the Render Score stops playback** (B4). Position preservation across edits is spike
   S3 (S2-10).
5. **Every Render Score must have its Playback Score registered before `renderScore`**, because
   `midiLoad` runs synchronously inside it. The pair should be kept in a `WeakMap` keyed by the
   Render Score, so a replaced pair can be collected.
6. **The MIDI is generated twice per load** (Render, then Playback). The cost was not measured; it
   belongs to the edit-loop budget of S3 (S2-10).
7. **Tick lookup and Playback MIDI must share one time axis.** This holds when the Playback tracks
   are a subset of the Render tracks with the same master bars; the hook throws otherwise.

React, Next.js and Turbopack: the harness is plain HTML, so this spike adds no evidence about
bundling. The hook needs only `AlphaTabApi` events, so it would attach in the same effect that
creates the API in spike S1 (`spikes/s1-turbopack/src/app/score-spike.tsx`) and detach before
`api.destroy()`. No per-frame work runs through React: the hook runs on MIDI loads only.

## 8. Manual browser checklist (owner)

Automated tests observe events, not sound. The checklist for a manual run: start
`pnpm --filter @musichub/spike-s2-mhd-to-alphatab s7:serve` and open http://127.0.0.1:3270/.

| Step | Expected |
|---|---|
| Play | Piano in bar 1, bass in bar 2; **no strings** (track B is rendered but excluded) |
| Watch the cursor | It moves over the Render Score, including the strings staff, in time with the sound |
| Mute A (Playback track), play | Only the bass sounds |
| Unmute all, Solo C, play | Only the bass sounds |
| Unmute all, play, press "Replace Render Score (E16)" while playing | Playback stops; E16 is shown; Play plays 15 tracks, not the 16th (key 55) |
| Open `/?hook=off` and play | Control: strings audible on the piano's channel (what alphaTab does without the hook) |

**Result (2026‑11‑24): passed.** The owner tested the S2-07 behaviour manually in the browser and
reported that everything checked worked correctly, with no issues observed. The owner did not
specify the browsers, browser versions, environment or which checklist steps were covered;
none are recorded here, and none are inferred.

This manual verification is separate from the automated browser tests (§6, B1–B4: Playwright
Chromium and WebKit, sequencer events only). The agent did not perform any manual check. Sustain
pedal and hand split are not part of the checklist and remain untested (§1).

## 9. Limitations

- One alphaTab version (1.9.0, pinned). The `midiLoad` mutation contract is not documented and
  may change in another version; a version bump must re-run this spike.
- Browser evidence uses `midiEventsPlayed` (sequencer events), not audio. Audio-level mute/solo is
  measured only offline in Node; audibility in browsers is the manual checklist (§8).
- WebKit is Playwright's engine build, not Safari. Firefox was not automated.
- Small documents only; no performance numbers. Backing tracks, count-in, metronome, playback
  ranges, looping and `exportAudio` were not tested.
- The mix-volume correction in the browser is not observable from the page; it is verified only
  by replaying alphaTab's call order in Node (C5).
- The sustain pedal and the hand split (MUSIC_ENGINE.md §5.2) are not covered (§1).

## 10. Recommendation

**Keep the Render Score / Playback Score architecture (ADR-0002 A5).** The separation works with
alphaTab 1.9.0 through one public event, under the constraints in §7. Nothing in the evidence
requires changing MHD, the Q-C policy or the A5 data flow.

The mechanism is a workaround, not a supported alphaTab feature. If the owner does not accept a
dependence on changing the `midiLoad` payload, the documented fallback is the one in
MUSIC_ENGINE.md §5.2: render the Playback Score as well (excluded tracks not shown), which avoids
the hook but hides tracks from the notation.

## 11. Owner decision and remaining questions

Decided (2026‑11‑24): keep the Render Score / Playback Score separation and the `midiLoad` hook,
with the constraints recorded in ADR-0002 Amendment 2 (A7–A8). The fallback (§10) is not
implemented and stays an option.

Still open:

1. UI behaviour for an excluded track (disabled mute/solo, how the exclusion is shown).
2. The S7 sub-questions not covered here: sustain-pedal audibility and the hand split (§1).
3. An audio-export path that uses the Playback Score (§7.3).
