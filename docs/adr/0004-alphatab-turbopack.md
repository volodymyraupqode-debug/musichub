# ADR-0004: alphaTab integration under Next.js Turbopack

- **Status:** Accepted with documented limitations
- **Date:** 2026-11-21 (proposed), 2026-11-23 (accepted after spike S1, ROADMAP.md S2-04)
- **Deciders:** project owner
- **Spec sections:** ARCHITECTURE.md §4; MUSIC_ENGINE.md §2.3, §10 (S1)
- **Evidence:** [docs/spikes/s1-turbopack.md](../spikes/s1-turbopack.md)
- **Addendum:** 2026-11-24, spike S6 clock findings, status *Deferred* (no decision), see [Addendum](#addendum-2026-11-24-spike-s6-clock-measurements--status-deferred)
- **Addendum 2:** 2026-11-25, S6 audio clock fallback accepted by the owner, see [Addendum 2](#addendum-2-2026-11-25-s6-audio-clock-fallback--accepted-owner-decision)

## Context

Next.js 16 builds with Turbopack by default, and Turbopack runs no webpack plugins. alphaTab 1.9.0 documents a Turbopack setup ("Next.js with Turbopack"): copy its runtime assets into `public/` and point `core.scriptFile`, `core.fontDirectory` and `player.soundFont` at them. Before spike S1 it was open whether rendering runs in a worker under Turbopack, whether the production build works, whether playback works in Chrome, Firefox and Safari, and what the worklet core costs.

## Decision

- Integrate alphaTab 1.9.0 with the documented Turbopack setup, without `@coderline/alphatab-webpack` and without `next build --webpack`.
- A `predev`/`prebuild` script copies `font/`, `soundfont/`, `alphaTab.mjs` and `alphaTab.core.mjs` from the installed package into a git-ignored `public/alphatab/` of the consuming app.
- Settings: `core.scriptFile: '/alphatab/alphaTab.mjs'`, `core.fontDirectory: '/alphatab/font/'`, `player.soundFont: '/alphatab/soundfont/sonivox.sf2'` (prefixed with `basePath` if one is used); `core.useWorkers: true`; `player.outputMode: WebAudioAudioWorklets`.
- alphaTab is created only in the browser (`useEffect`) and destroyed with `api.destroy()`.
- The setup and the copy script move into the production architecture (`packages/music-engine`, `apps/web`) in **Phase 1**. Until then they exist only in `spikes/s1-turbopack`; alphaTab stays banned outside `packages/music-engine` and `spikes/*`.
- The alphaTab attribution ("♪ alphaTab.net") stays visible as alphaTab renders it (PROJECT_SPEC.md §7, Q9).
- `next build --webpack` with `@coderline/alphatab-webpack` remains a documented fallback only; switching to it requires a new ADR.

## Rationale (spike S1)

- Turbopack bundles and starts the alphaTab workers itself (2 workers per alphaTab instance, `turbopack-worker-*.js`).
- The audio worklet loads `alphaTab.mjs` / `alphaTab.core.mjs` from `public/alphatab/` through `core.scriptFile` (`AudioWorklet.addModule` succeeded).
- Development (`next dev`) and production (`next build` + `next start`) both work with Next.js 16.4.6, React 19.3.1 and alphaTab 1.9.0.
- Theming through `display.resources` changes the colours alphaTab writes into its SVG output.
- Browser matrix:

| Browser | How it was checked | Result |
|---|---|---|
| Chromium | Automated: embedded Chromium (dev + production, playback cycle via instrumentation) and Playwright smoke | PASS |
| Playwright WebKit | Automated: Playwright smoke (production). This is Playwright's WebKit build, not Safari | PASS |
| Safari | Manual check by the owner, including audible playback, pause and resume | PASS |
| Firefox | Manual check by the owner, including audible playback, pause and resume | PASS |

Safari and Firefox were not covered by automated tests; their versions and timings were not recorded.

## Limitations

- **Two copies of alphaTab.** alphaTab is part of the Turbopack bundle (in the spike the largest JS chunk was 1,261,900 B) and is also served as `public/alphatab/alphaTab.core.mjs` for the audio worklet, loaded on the first Play. In the spike build the core measured 2,606,053 B (533,385 B gzip); this is a measurement of alphaTab 1.9.0 in that build, not a guaranteed size for future versions.
- **Caching.** `/alphatab/*` should be cached for a long time, but `immutable` caching is allowed only for versioned or otherwise guaranteed-unchanging URLs. The copied file names are not content-hashed, so the production setup must either version the path (for example by alphaTab version) or use revalidating cache headers. Decided in Phase 1.
- **Track selection.** `api.tex()` and `renderTracks` render only the first track unless the track list (or `'all'`) is passed.
- **Attribution check.** The attribution is drawn as SVG paths, not text; it can only be verified visually or by image comparison.
- **Not measured:** autoplay behaviour (the embedded Chromium allowed audio without a gesture), `AudioContext.outputLatency`, and the real latency to audible sound. These belong to spike S6 and Phase 2 calibration.

## Consequences

- Phase 1 builds `packages/music-engine` and the `apps/web` integration on this setup, moving the copy script and settings from `spikes/s1-turbopack` (the spike stays until the end of Sprint 2 for S2/S3/S7).
- Phase 1 decides the cache strategy for `/alphatab/*` (versioned path or revalidation) and may copy only the files that are used (`sonivox.sf2`, the Bravura web font, licence texts).
- The third-party notices page lists alphaTab (MPL-2.0), Bravura (OFL) and SONiVOX (Apache-2.0).
- Every code path that renders a score passes the track list explicitly.
- The mobile `ScoreView` bundle (MOBILE.md §4.4) is built with Vite and is not covered by this ADR.

## Alternatives considered

- **`next build --webpack` + `@coderline/alphatab-webpack`:** not needed, since Turbopack works in all four browser checks; it would leave the Next.js default build and add a plugin. Kept as fallback.

## Addendum (2026-11-24): spike S6 clock measurements — status Deferred

This addendum records findings only; the decision above is unchanged and no clock decision is taken. Evidence: [docs/spikes/s6-audio-clock-accuracy.md](../spikes/s6-audio-clock-accuracy.md) (ROADMAP.md S2-08).

- alphaTab 1.9.0 `playerPositionChanged` timing was measured against the browser's audio-frame clock in Playwright Chromium and Playwright WebKit (headless, macOS). p95 anchor jitter: Chromium below 10 ms in 9/9 runs; WebKit above 10 ms at the default `positionUpdateIntervalInMilliseconds = 10` in 3 of 4 speed-1.0 runs and below 10 ms at `0` in 3/3 runs.
- Only browser-reported latency values were recorded (`outputLatency` 24 ms in Chromium, 8.94 ms in WebKit). The *Not measured* item above (real latency to audible sound) remains open: no loopback was performed, and Safari on a real device and Firefox were not measured.
- Provisional, not accepted: 10 ms as the base interval for Chromium; `0` as a possible fallback for WebKit, not confirmed for Safari. A decision is deferred until measurements against the audio output exist.

## Addendum 2 (2026-11-25): S6 audio clock fallback — accepted (owner decision)

The decision above and the 2026-11-24 addendum are unchanged; this addendum records a new decision. The 2026-11-24 addendum deferred a clock decision "until measurements against the audio output exist". The owner has decided **not** to wait for such measurements and accepts the fallback below on the evidence of the offline replay, with the limitations listed. ROADMAP.md Phase 0 exit criterion 3 ("S6 clock jitter < 10 ms, or a fallback is chosen") is met through the fallback alternative; the 10 ms target itself is unchanged and not claimed as met.

Evidence: offline replay of the 18 historical S6 runs through a research clock model, [spikes/s6-audio-clock/REPLAY.md](../../spikes/s6-audio-clock/REPLAY.md) (commit `9b21fe8`; per-run results in `spikes/s6-audio-clock/data/clock-replay/`), and the S6 report [docs/spikes/s6-audio-clock-accuracy.md](../spikes/s6-audio-clock-accuracy.md).

**Accepted fallback (to be implemented in Phase 1 by `packages/music-engine`):**

1. **Clock model:** an audio-anchored, interpolated playback clock (MUSIC_ENGINE.md §5.1). Each `playerPositionChanged` event is an anchor; between anchors the clock extrapolates with `performance.now()` at the playback speed.
2. **Anchors:** score time = `currentTime × playbackSpeed` (milliseconds on alphaTab's timeline; alphaTab rescales `currentTime` on a speed change and emits a seek, the product stays continuous). `currentTick` is tracked separately: it is an integer, truncated and offset by one tick, and converting between ticks and time needs the tempo map, so the two are not interchangeable.
3. **Corrections:** a new anchor that differs from the displayed clock by less than **30 ms** (playback time) is **slewed** at **10 %** of elapsed playback time; a difference of 30 ms or more **snaps**.
4. **Update interval:** `positionUpdateIntervalInMilliseconds = 0` for WebKit/Safari; `10` (the alphaTab default, the validated configuration) for Chromium and other browsers.
5. **No extrapolation before a valid anchor:** after play, resume or a seek (`isSeek`, including alphaTab's pause reset, stop reset, loop restart and speed change), the clock holds its position until the first valid main-playback anchor arrives.

**Accepted limitations (not resolved by this decision):**

- No physical audio-output loopback was performed.
- No real Safari, Firefox, mobile or other hardware testing was performed; Playwright WebKit is not Safari.
- The offline replay uses historical browser-clock data against the player's own audio-frame timeline, not sound at the output.
- WebKit p99 at the 0 ms interval reached 9.54 ms in the worst recorded run, 0.46 ms below the 10 ms target; only three WebKit runs exist at the 0 ms interval.
- The CPU and message overhead of the 0 ms interval was not measured.
- Speed changes, pauses during playback, loops and count-in are covered by 17 synthetic lifecycle tests of the model, not by the recorded runs.
- Physical output latency is unknown; calibration (Phase 2) remains unverified.
- The S6 clock model is research code. Phase 1 must implement this policy in `music-engine` and verify it there.

