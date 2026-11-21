# MusicHub — Piano Visualizer & Practice Mode

> Status: Draft v0.2 (audited 2026‑11‑21) — awaiting approval. Packages: `piano-visualizer` (geometry + Canvas painter, no React) and `practice-core` (practice logic, pure TS). Both depend only on `music-model` (timeline, `PlaybackClock`, `LiveNoteSource` contracts; MUSIC_ENGINE.md §3.5–3.6). alphaTab has no falling-notes or keyboard view, so this is our own code.
>
> **Changelog v0.2:**
> - Practice mode (wait mode, correctness check, hand selection) is in scope for Phase 2; it was post‑v1 in v0.1.
> - Hands now come from the document model.
> - The sync design is now explicitly anchored to the audio engine (§5).
> - Keyboard geometry is shared with the Piano Roll.
> - The live input contract moved to `music-model` (implemented by `midi-engine`).
>
> **Changelog v0.2.2:** Q20/Q21: practice scope in §6.0 (personal practice only; guitar correctness only via MIDI after S8; no microphone analysis in v1).
>
> **Changelog v0.2.1:** Q16: practice results are summarised per session and synced to the server (§6.2). No raw MIDI/audio is stored.

## 1. Goals

| Requirement | Section |
|---|---|
| 88-key keyboard A0 (MIDI 21) – C8 (MIDI 108) | §3.1 |
| Falling notes towards the keyboard; bar length = note duration | §3 |
| Key highlight while sounding / pressed | §3, §4 |
| Sound synchronised with animation (audio-engine time base) | §5 |
| Many simultaneous notes (polyphony, chords) | §3 (no voice limit) |
| Left/right hand colors | §2, §3.2 |
| Piano Roll (shares geometry) | §7, MUSIC_ENGINE.md §8 |
| Playback speed change | §5 (clock speed) |
| Loop of a selected fragment | §5, §6 |
| Learning mode | §6 |
| MIDI keyboard connection | §4 |
| Correctness check of the user's playing | §6.2 |

Performance target: 60 fps on mid-range laptops with dense pieces (≥ 30 notes/s); 30 fps fallback on mobile. On mobile the painter runs in a WebView (V1) or as a native painter reusing the pure geometry/culling (V2), decided by the mobile prototype (MOBILE.md §4.3). The geometry/culling module must therefore never depend on DOM or Canvas APIs.

Non-goals v1: 3D view, particle effects, video export, gamified leaderboards.

## 2. Inputs

```ts
type VisualizerInput = {
  events: NoteEvent[];             // music-model timeline, playback order (repeats expanded); includes `hand`
  tracks: { id: string; color: string; visible: boolean }[];
  clock: PlaybackClock;            // audio-anchored (MUSIC_ENGINE.md §5.1)
  liveInput?: LiveNoteSource;      // MIDI keyboard (midi-engine)
  feedback?: PracticeFeedbackSource; // practice-core results (§6), optional
  settings: VisualizerSettings;
};

type VisualizerSettings = {
  lookAheadMs: number;             // visible future window, default 3000 (zoom)
  keyRange: { low: number; high: number }; // default 21..108; auto-fit option
  showNoteNames: 'none' | 'c-only' | 'all';
  colorMode: 'hand' | 'track' | 'velocity'; // default 'hand' for keyboard tracks
  reduceMotion: boolean;
};
```

**Hands:** `NoteEvent.hand` is resolved by the timeline from `Note.hand ?? Staff.hand ?? default`. The default for a 2-staff keyboard track is upper staff = right, lower = left. For other tracks the hand is undefined and the track color is used. The calibration offset lives in the clock, not in the visualizer.

## 3. Rendering

- **Canvas 2D** first: one canvas for the waterfall, one for the keyboard, sized with `devicePixelRatio`. Canvas 2D is the approved technology (PROJECT_SPEC §5.1). WebGL is considered only if profiling shows Canvas 2D cannot hold 60 fps, and needs an ADR plus owner approval. Three.js is not approved for now (3D is a non-goal).
- **Own `requestAnimationFrame` loop, outside React.** Each frame reads `clock.now().ms` and draws events with `startMs < now + lookAheadMs && endMs > now`. React only mounts the canvases and passes settings.
- **Note bars:** `y = keyboardTop − (startMs − now) × pxPerMs`, `height = durationMs × pxPerMs` (minimum 4 px). Bar length is therefore proportional to note duration at the current zoom. Speed changes do not change bar length, because lengths are in score time.
- **Culling:** events are sorted by `startMs`; a binary search finds the window start, and an interval list of active long notes avoids rescans. Cost is O(visible) per frame.
- **Static layer caching:** keyboard geometry is pre-rendered to an offscreen canvas; only changed keys are redrawn per frame.
- The loop pauses when the tab is hidden or the panel is collapsed. `OffscreenCanvas` in a worker is a later optimisation (Safari support to verify).

### 3.1 Keyboard geometry (pure module, shared with the Piano Roll)

- 52 white keys and 36 black keys for 21..108. White key width `w = width / whiteKeyCount(range)`.
- Black key ≈ 0.58 w wide and ≈ 0.63 of the white key height, with standard group offsets (C♯/D♯ pair, F♯/G♯/A♯ triple). Falling-note columns align with key centres.
- `pitchToKey(pitch) → { x, width, isBlack }` is precomputed for 0..127. It is exported for the Piano Roll's vertical keyboard (rotated use).

### 3.2 Colors

From design tokens (DESIGN_SYSTEM.md §2, domain tier): `hand.left`, `hand.right`, the track palette, `key.pressed` (playback), `key.live` (user input), and `practice.correct / early / late / wrong / missed`. Black-key notes use a darker shade of the same hue. Contrast ≥ 3:1 against the waterfall background in both themes.

## 4. Live MIDI input

- `LiveNoteSource` is implemented by `midi-engine` (Web MIDI). It is unavailable in Safari and iOS WKWebView; there the UI hides MIDI features with an explanation. On mobile a native module implements the same contract (MOBILE.md §3).
- Pressed keys are drawn in `key.live`. If the key is also sounding in playback, it is drawn as a split/outlined state.
- Monitoring sound for pressed keys: see MUSIC_ENGINE.md §9 (latency spike in Phase 2).

## 5. Synchronisation (audio engine is the time base)

1. The **only** time source is `PlaybackClock.now()`. It is anchored to alphaTab synth positions (`playerPositionChanged`, emitted as audio samples are played) and extrapolated with `performance.now()` between anchors (MUSIC_ENGINE.md §5.1). Neither React render cycles nor `setInterval` timers drive animation.
2. Every frame computes positions from `now()`. Dropped frames therefore never accumulate drift; the next frame is simply correct.
3. **Speed:** clock `ms` is score time and already includes `playbackSpeed`.
4. **Loop / seek:** the clock emits `onSeek`; the visualizer resets active-note state, and practice-core resets the window.
5. **Output latency:** subtract an estimated output latency (per browser/device table, refined in S6), then the user calibration offset (calibration screen: tap along to metronome clicks).
6. **Parity:** event times come from our timeline, audio from alphaTab's MIDI. They are kept equal by S5 golden tests. Until S5 passes, keys can be highlighted from `activeBeatsChanged` (alphaTab beats → MHD notes via `idMap`), which is exact but beat-granular.

Verification (spike S6, test plan): record the clock error against `playerPositionChanged` anchors over 5 min of playback at speeds 0.5/1.0/1.5 in Chrome, Firefox and Safari. The target is < 10 ms jitter; the perceived offset target is < 20 ms after calibration.

## 6. Practice mode (`practice-core`)

### 6.0 Scope (Q20, Q21)

- v1 is **personal practice**: fragments, goals, stats, accuracy, BPM, attempts, time, history and resume. Courses, lessons, curricula, teachers, certificates and LMS features are post‑v1 (Q20).
- Correctness checking in v1 needs MIDI input from a MIDI keyboard. **Guitar practice in v1:** notation/tab display, playback, loop, speed, count-in, and listen/play-along with time, BPM and attempt statistics (`input_source = 'none'`), without correctness checking. MIDI-guitar checking only if spike S8 passes and the owner approves. Microphone analysis is post‑v1 Audio/AI (MUSIC_ENGINE.md §11a).
- `practice-core` is source-agnostic: it evaluates any `LiveNoteSource`, and each session is tagged with `source = 'free_practice'`. Future lesson engines or microphone sources plug in without changing the evaluator or the stored data.

### 6.1 Session

```ts
type PracticeSettings = {
  hands: 'both' | 'left' | 'right';        // which hand the user plays
  playOtherHand: boolean;                   // accompaniment audible (uses hand-split playback score, MUSIC_ENGINE §5.2)
  mode: 'listen' | 'play-along' | 'wait';   // wait = playback pauses until the expected notes are played
  loop: { startTick: number; endTick: number } | null;
  speed: number;                            // 0.25–1.0 (+ optional auto-increase after N clean loops)
  timingWindowMs: number;                   // default ±120 ms (play-along)
};
```

State machine: `idle → countIn → running ⇄ waiting (wait mode) → loopRestart → finished`. In wait mode, practice-core asks the host to `pause()` at the next expected chord and to `play()` once all expected pitches of the user's hand are down (order-free, within 50 ms chord tolerance). The visualizer keeps rendering from the paused clock.

### 6.2 Correctness check

- Expected notes = `NoteEvent`s of the selected hand(s) within the loop range.
- Played notes come from `LiveNoteSource`. Their `timeStamp` (same time base as `performance.now()`) is converted to score time through the clock's current anchor, so evaluation uses the audio time base, not the frame time.
- Matching: greedy by pitch within `timingWindowMs`. Classification: **correct**, **early**, **late**, **wrong pitch**, **missed**, **extra**. Duration accuracy is optional (note-off vs expected end, ±25 %).
- Output: per-note feedback stream (drawn on the falling notes and keys) and per-loop stats `{ accuracy, timingMeanMs, timingStdMs, missed, extra }`.
- When a session ends, `practice-core` builds a `PracticeSession` summary (API.md §7a: time, attempts, speed/BPM, note counts, accuracy, timing, completed fragment). It is stored locally first and synced to the server when enabled (ARCHITECTURE.md §6a, Q16 resolved). Raw MIDI events are discarded after evaluation; audio is never recorded.
- Completion criteria per fragment: default accuracy ≥ 0.9 at the target speed, or the user's goal (`practice_goals`). The UI shows best accuracy, best BPM, practice time, attempts and the resume position per composition.

### 6.3 UX

- Practice view `/practice/[compositionId]`: visualizer full-height; score strip optional; controls for hand, mode, loop (A‑B from score selection via alphaTab range highlight, or bar numbers), speed and count-in.
- Without MIDI (Safari, no device), only the `listen` mode is available.

## 7. Piano Roll relation

The Piano Roll (MUSIC_ENGINE.md §8) is an editor in the studio. It reuses `pitchToKey` geometry, the same `NoteEvent` timeline (score order) and the same clock for its playhead. It does not reuse the falling-notes painter.

## 8. Package API

```ts
const viz = createPianoVisualizer(containerEl, settings);
viz.setEvents(events, tracks);      // on document change (debounced)
viz.attachClock(clock);
viz.attachLiveInput(source | null);
viz.attachFeedback(source | null);  // practice-core
viz.updateSettings(partial);
viz.resize();                       // host calls from ResizeObserver
viz.destroy();

const practice = createPracticeSession({ events, clock, input, transport, settings }); // practice-core
practice.start(); practice.stop(); practice.onFeedback(cb); practice.onLoopStats(cb);
practice.onSessionSummary(cb);   // PracticeSession (API.md §7a) → host stores it in the local outbox
```

`transport` is a minimal interface (`play`, `pause`, `seek`, `setLoop`, `setSpeed`, `setTrackMix`) implemented by `music-engine`'s `PlaybackController`, so `practice-core` has no alphaTab dependency.

## 9. Performance budget & tests

| Metric | Budget |
|---|---|
| Frame time, desktop, 50 visible notes | ≤ 4 ms JS |
| Frame time, mobile (V1 or V2) | ≤ 10 ms JS (30 fps fallback) |
| Practice evaluation per input event | ≤ 1 ms |

Tests:
- Geometry for all 88 keys; culling.
- Deterministic snapshots at fixed clock times (fake clock).
- Practice evaluation tables: early, late, wrong, missed, chords, wait-mode transitions with a fake clock and fake input.
- An end-to-end Playwright test with a virtual MIDI source injected through the `LiveNoteSource` interface.

## 10. Risks

| ID | Risk | Mitigation |
|---|---|---|
| V1 | Timeline vs alphaTab audio mismatch (repeats, ties, grace notes) | Spike S5; interim `activeBeatsChanged` highlighting |
| V2 | Jitter/latency of position events; no AudioContext access | Audio-anchored clock + latency table + calibration (S6) |
| V3 | Mobile drawing performance | Prototype M6 (V1 vs V2); reduced effects, 30 fps mode, key range auto-fit |
| V4 | Web MIDI unavailable on Safari; not usable in RN | Feature detection on web; native MIDI module on mobile (MOBILE.md §3, prototype M1) |
| V5 | One-hand accompaniment needs a hand-split playback score; feasibility unknown | Spike S7 (MUSIC_ENGINE.md §5.2) |
| V6 | Wait mode pause/resume latency with alphaTab player | Measure in Phase 2; pre-pause slightly before the expected chord |
