# S6 follow-up — offline replay of the audio-anchored clock

> **Scope:** offline replay of the 18 historical S6 browser-clock runs (`data/raw/`) through a
> research clock model. **No new browser measurements were performed. No physical audio loopback
> was performed. No real Safari, Firefox or mobile testing was performed.** The replayed error is
> measured against the player's own audio-frame timeline; it is **not** proof of physical
> audio-output accuracy. No fallback is selected here; S6 stays partly done (ROADMAP S2-08).

## 1. What was replayed

- **Inputs:** the 18 raw runs of S6 (Playwright Chromium and Playwright WebKit, headless, macOS;
  intervals 10 ms and 0 ms; speeds 0.5/1.0/1.5; 60 s and 300 s), unchanged (checksums verified
  before and after). Events: `playerPositionChanged` (`arrival`, `currentTime`, `currentTick`,
  `isSeek`), `playerStateChanged` (`meta.states`) and every `requestAnimationFrame` time.
- **Model:** `src/clock.ts` (pure TypeScript, research only). Units and assumptions:
  - Score time = `currentTime × playbackSpeed` (ms on alphaTab's timeline). alphaTab rescales
    `currentTime` on a speed change (`updatePlaybackSpeed`, alphaTab.core.mjs 44133–44137) and emits
    a seek; the product stays continuous.
  - `currentTick` = `floor((currentTime × speed − tempoChange.time) / msPerTick) + ticks + 1`
    (`currentTimePositionToTickPosition`, 40660–40668): an integer, truncated, offset by one tick
    (≤ 0.52 ms at 120 BPM, 960 PPQ). The two anchors are **not** interchangeable: time → tick needs
    the tempo map. The model keeps the tick anchor separately and extrapolates it only with a
    supplied tempo; the replay evaluates the time anchor.
  - Extrapolation only in state `playing` and only after the first main-playback anchor after a
    play, resume or seek (count-in, playback start and loop restart emit no anchor).
  - `isSeek`: snap, hold, and wait for the next anchor. Pause and stop freeze the clock; alphaTab's
    pause reset to the beat start (`_onPlayerStateChanged`, 53535–53544) and the stop reset arrive as
    seeks. End of score: clamped. Out-of-order events are rejected; exact duplicates are ignored.
- **Policies** (fixed before the replay): *interpolation* (every anchor applied at once; this is the
  plain-interpolation baseline of the S6 report), *slew + snap ≥ 20 / 30 / 40 ms* (smaller
  corrections absorbed at 10 % of elapsed playback time, larger ones snap), and *slew, never snap*
  (to isolate what the snaps contribute). Exploratory slew rates 5 % and 20 % at 30 ms are reported
  separately, split into tuning runs (60 s, speed 1.0) and held-out runs (speeds 0.5/1.5, 300 s).
- **Error:** at every animation frame in the steady window (S6 report §4), e = (C(t) − R(t)) / speed
  in playback ms, with R the fitted audio-frame timeline of the run. Reported: |e − bias| with bias
  = median(e) (a constant offset is latency, not jitter), and max |e|.

Reproduce: `pnpm --filter @musichub/spike-s6-audio-clock replay-clock` (writes
`data/clock-replay/summary.json` and `summary.md`, including every per-run row).

## 2. Results

### Per browser and interval (pooled runs; worst run in brackets)

| Browser | Interval | Variant | Runs | Frames | p95 range over runs | worst p99 | worst max | Snaps total | Snaps/min (worst run) | Max snap |
|---|---|---|---|---|---|---|---|---|---|---|
| chromium | 0 | interpolation (snap every anchor) | 3 | 10701 | 0.26–0.61 | 2.60 | 10.40 | 0 | 0.00 | 0.00 |
| chromium | 0 | slew + snap ≥ 20 ms | 3 | 10701 | 0.24–0.53 | 0.90 | 5.23 | 2 | 2.02 | 24.90 |
| chromium | 0 | slew + snap ≥ 30 ms | 3 | 10701 | 0.24–0.53 | 0.90 | 3.32 | 0 | 0.00 | 0.00 |
| chromium | 0 | slew + snap ≥ 40 ms | 3 | 10701 | 0.24–0.53 | 0.90 | 3.32 | 0 | 0.00 | 0.00 |
| chromium | 0 | slew, never snap | 3 | 10701 | 0.24–0.53 | 0.90 | 3.32 | 0 | 0.00 | 0.00 |
| chromium | 10 | interpolation (snap every anchor) | 6 | 35807 | 0.21–0.70 | 1.23 | 9.54 | 1 | 1.01 | 63.23 |
| chromium | 10 | slew + snap ≥ 20 ms | 6 | 35807 | 0.23–0.58 | 0.91 | 3.13 | 4 | 4.03 | 63.23 |
| chromium | 10 | slew + snap ≥ 30 ms | 6 | 35807 | 0.23–0.58 | 0.91 | 3.13 | 3 | 3.03 | 63.23 |
| chromium | 10 | slew + snap ≥ 40 ms | 6 | 35807 | 0.23–0.59 | 0.98 | 19.55 | 2 | 2.02 | 63.23 |
| chromium | 10 | slew, never snap | 6 | 35807 | 0.23–0.58 | 0.91 | 3.13 | 0 | 0.00 | 0.00 |
| webkit | 0 | interpolation (snap every anchor) | 3 | 10580 | 4.58–7.89 | 9.66 | 19.25 | 3 | 1.01 | 53.33 |
| webkit | 0 | slew + snap ≥ 20 ms | 3 | 10580 | 4.45–7.96 | 9.71 | 28.08 | 16 | 6.07 | 53.33 |
| webkit | 0 | slew + snap ≥ 30 ms | 3 | 10580 | 4.43–7.89 | 9.54 | 17.45 | 6 | 2.02 | 53.33 |
| webkit | 0 | slew + snap ≥ 40 ms | 3 | 10580 | 4.43–7.88 | 9.54 | 49.46 | 4 | 2.02 | 53.33 |
| webkit | 0 | slew, never snap | 3 | 10580 | 4.43–7.88 | 9.54 | 10.32 | 0 | 0.00 | 0.00 |
| webkit | 10 | interpolation (snap every anchor) | 6 | 35601 | 7.54–13.49 | 16.74 | 145.71 | 17 | 4.04 | 296.33 |
| webkit | 10 | slew + snap ≥ 20 ms | 6 | 35601 | 6.87–13.33 | 16.45 | 145.68 | 95 | 22.16 | 296.33 |
| webkit | 10 | slew + snap ≥ 30 ms | 6 | 35601 | 6.88–13.26 | 16.37 | 145.68 | 40 | 13.13 | 296.33 |
| webkit | 10 | slew + snap ≥ 40 ms | 6 | 35601 | 6.89–13.03 | 16.60 | 145.73 | 22 | 8.08 | 296.33 |
| webkit | 10 | slew, never snap | 6 | 35601 | 6.89–14.37 | 134.78 | 145.65 | 0 | 0.00 | 0.00 |

Per-run rows, the plain-interpolation correction counts and the anchor checks are in
`data/clock-replay/summary.md`.

**Plain interpolation, visible corrections ≥ 5 ms per minute:** Chromium 4–28; WebKit 326–686
(interval 0: 665–686; interval 10: 258–480). Under this policy every correction is a jump of the
displayed position.

**Anchor availability and event checks (all runs):** 0 out-of-order events; 1 exact duplicate per
run (ignored); 7 seeks per run, all before playback or at the end (start-up and stop resets). Wait
from the `playing` state to the first main-playback anchor: Chromium 139–215 ms, WebKit 246–345 ms;
a clock extrapolating from the state change would run ahead by that much at every start. Anchor gaps
> 50 ms while playing: Chromium 0–1 per run (max 73.9 ms), WebKit 0–5 per run (max 307 ms, the stall
of `webkit-i10-s1-d60-r2`). Not available from the data: speed changes, pauses during playback,
loops and count-in (none were recorded); these are covered only by the synthetic tests
(`src/clock.test.ts`).

**Per-run outliers:** `webkit-i10-s1-d60-r2` (307 ms stall; max snap 296 ms, max error ≈ 146 ms in
every variant); `webkit-i10-s1-d300-r1` (p99 15.4–15.5 ms; 40 ms threshold max error 47 ms);
`chromium-i10-s1-d60-r2` (one 63 ms snap, the 73.9 ms gap).

## 3. Findings

1. **Interpolation error vs slewed error.** Slewing changes the error distribution only slightly:
   Chromium p95 0.21–0.70 → 0.23–0.58 ms, worst p99 1.23 → 0.91 ms, worst max 9.5 → 3.1 ms
   (interval 10, 30 ms); WebKit p95 almost unchanged (interval 0: 4.58–7.89 → 4.43–7.89 ms; interval 10:
   7.54–13.49 → 6.88–13.26 ms). The WebKit error is dominated by the slow wander of its audio
   clock (S6 report §7.2), which no correction policy removes.
2. **What slewing buys is smoothness, not accuracy:** it replaces WebKit's 300–700 visible
   ≥ 5 ms corrections per minute by gradual catch-up plus a few snaps.
3. **Snaps.** Slewing produces *more* threshold snaps than plain interpolation has corrections of
   the same size (WebKit interval 10 at 30 ms: 40 vs 17; interval 0: 6 vs 3), because the residual
   offset adds to the next correction. Per minute (worst run), 30 ms: Chromium ≤ 3, WebKit interval 0
   ≤ 2, interval 10 ≤ 13. Snap magnitudes reach 30–300 ms (stalls).
4. **Threshold trade-off.** 20 ms snaps 2–3× more often than 30 ms (WebKit interval 10: 95 vs 40;
   interval 0: 16 vs 6). 40 ms snaps less but leaves mid-size corrections to a slow slew, which raises
   the maximum error (Chromium interval 10 max 19.6 ms vs 3.1 ms; WebKit interval 0 max 49.5 vs
   17.5 ms). 30 ms gives the lowest or tied-lowest maximum error of the snapping variants in every
   group. Never
   snapping is unusable in a stall (WebKit p99 134.8 ms).
5. **Slew rate.** 5 % / 10 % / 20 % differ by < 0.5 ms p95 in both splits; 5 % is marginally better on
   the tuning and the held-out runs. Not adopted: the difference is within run-to-run variation.
6. **Update interval.** WebKit: interval 0 lowers p95 from 6.9–13.3 to 4.4–7.9 ms and worst p99 from
   16.4 to 9.5 ms (30 ms policy) and reduces snaps (40 → 6). Chromium: no measurable difference
   (0.23–0.58 vs 0.24–0.53 ms p95) at about four times the event rate.
7. **10 ms target.** With interval 0 and the 30 ms policy, every WebKit run stays below 10 ms at p95
   (≤ 7.89 ms) and p99 (≤ 9.54 ms), close to the limit; with interval 10 three of six WebKit runs exceed
   10 ms at p95 (12.2–13.3 ms) and four of six at p99 (only the speed-0.5 and speed-1.5 runs stay
   below). Chromium is below 1 ms p99 either way.
   This concerns the offline error against the browser's audio-frame timeline only.

## 4. Technical recommendation (not an owner decision)

- Policy: **slew below 30 ms, snap at or above**, slew rate 10 % (no evidence for another value),
  extrapolation only after the first main-playback anchor, snap and hold on `isSeek`.
- Interval: **0 ms for WebKit/Safari**; 10 ms elsewhere is equally accurate in Chromium and cheaper.
  Using 0 ms everywhere avoids engine detection at an unmeasured CPU and message cost.
- What users would notice: a short hold (139–345 ms) at playback start and after seeks; on pause, a
  backward jump to the beat start (alphaTab); in WebKit a few position snaps per minute (≥ 30 ms,
  up to ≈ 300 ms in a stall) and otherwise smooth catch-up of corrections below 30 ms.
- Whether this is accepted as the S6 fallback is the owner's decision.

## 5. Limitations and what remains unverified

- Historical headless Playwright data from one Intel Mac; Playwright WebKit is not Safari. No
  Firefox, real Safari, mobile or other hardware.
- The reference is the fitted audio-frame timeline of each run (S6 §4), not sound at the output;
  output latency and its variation are unknown.
- WebKit p99 at interval 0 is within 0.5 ms of the 10 ms target in the worst run; three runs per
  configuration are a small sample.
- Speed changes, pauses during playback, loops and count-in are not in the recorded data; only the
  synthetic tests cover them.
- The CPU and message cost of interval 0 is not measured.
- The model is research code; `PlaybackClock` in `packages/music-engine` (Phase 1) is not built.
