# Spike S6 — Audio clock accuracy (ROADMAP S2-08)

> Status: **automated part done; Phase 0 clock criterion not verified.** Measured: alphaTab
> `playerPositionChanged` timing against the browser's audio-frame clock, in Playwright Chromium
> and Playwright WebKit (headless, macOS). Not measured: physical audio output (no loopback),
> Safari on a real device, Firefox. The owner decided on 2026‑11‑24 that loopback and further
> measurements are not part of the current scope (§9, §11).

## 1. Question

MUSIC_ENGINE.md §5.1 anchors `PlaybackClock` to alphaTab's `playerPositionChanged` events and
extrapolates with `performance.now()` between them. Spike S6 (MUSIC_ENGINE.md §10,
PIANO_VISUALIZER.md §5) asks how often these events arrive, how much their timing jitters,
whether interpolation gives a more accurate visual clock, and how the clock compares with the
sound actually played. Phase 0 exit criterion (ROADMAP §Phase 0): **p95 jitter < 10 ms, or a
fallback is chosen**.

Out of scope: output-latency calibration (Phase 2). Constant latency is reported, never treated
as jitter, and not corrected.

## 2. Answer in short

| Question | Answer | Basis |
|---|---|---|
| Event delivery at the default 10 ms | Chromium: every ~10.67 ms (512 frames at 48 kHz), Δa p95 10.9–11.3 ms. WebKit: Δa median 11, p95 14–15 ms, with stalls up to 307 ms | measured, player events |
| Event delivery at 0 ms | Every render quantum is reported (E = 2.67 ms), but Chromium delivers them **in pairs** (Δa ≈ 0 and ≈ 5.3 ms), so the effective update period is ~5.3 ms. WebKit: Δa median 3 ms (1 ms timer resolution) | measured, player events |
| **p95 anchor jitter < 10 ms** | **Chromium: met in 9/9 runs** (0.24–0.76 ms at 10 ms, 2.52–2.55 ms at 0 ms). **WebKit: met in 6/9 runs**: at 10 ms and speed 1.0 it failed in 3 of 4 runs (9.69, 12.73, 13.64, 14.37 ms); at 0 ms it passed 3/3 (5.79–8.87 ms, p99 up to 10.86 ms) | measured, player events only |
| Does interpolation help | Yes for the step error: the raw position has p95 error ≈ 5.1 ms (10 ms) / 2.6 ms (0 ms) in Chromium; interpolation brings it to 0.21–0.70 ms. **In WebKit it does not**: the error follows a slow wander of the event timeline (§7.2), and neither interpolation nor regression windows up to 2 s remove it | measured, against the player's audio-frame timeline |
| Drift | Chromium +10.6…+18.3 ppm (≤ 4 ms over 300 s). WebKit −704…−1336 ppm (−251 ms over 300 s) | measured |
| Real audio output latency and jitter | **Not measured.** Browser-reported values only (Chromium `outputLatency` 24 ms, WebKit 8.94 ms) | no loopback available (§8) |
| Phase 0 criterion | **Insufficient evidence.** Met for Chromium player-event timing only; not met in headless WebKit at the default interval; no audio reference; Safari and Firefox not measured | §9 |

## 3. How alphaTab 1.9.0 produces the position (source)

Line numbers refer to `node_modules/@coderline/alphatab/dist/alphaTab.core.mjs`.

| What | Where | Finding |
|---|---|---|
| `PlayerSettings.positionUpdateIntervalInMilliseconds` | 30842 (docs 30843–30856) | New in 1.9.0, default `10`. "With `0` every audio render quantum (128 frames, about 3 milliseconds) is reported." Only the audio-worklet output uses it; it applies from the next playback start |
| `PlayedFramesAccumulator` | 46116–46156 | Counts rendered frames per 128-frame quantum; reports once `interval × sampleRate / 1000` frames are reached (so the real interval is rounded **up** to whole quanta), immediately when a quantum was not completely filled, and every quantum with `0` |
| Audio-worklet processor `process()` | 46207–46236 | Copies buffered samples to the output and posts `samplesPlayed` with the played frames to the main thread |
| `AlphaSynthBase._onSamplesPlayed` | 44377–44383 | `timePosition += samples / sampleRate × 1000`, then `updateTimePosition` |
| `updateTimePosition` / `_createPositionChangedEventArgs` | 44445; 44434 | Fires `positionChanged` with `currentTime = timePosition`, `currentTick` derived from it |

With the default worker player the report travels **audio thread → main thread (output
wrapper) → synthesizer worker → main thread** before `playerPositionChanged` runs (worklet
`postMessage` 46231 → main 46353 → worker 38247/54912 → `alphaSynth.positionChanged` 55108 →
main 38177). The position
counts frames the worklet consumed, i.e. it advances with the audio hardware clock; the arrival
time adds message passing and main-thread scheduling. alphaTab does not read
`AudioContext.outputLatency` or `getOutputTimestamp()`: the position is the time a frame left the
worklet, not the time it reached the speaker.

## 4. Method and formulas

**Clocks.** All timestamps are `performance.now()` on the page's main thread (monotonic,
high resolution; never `Date`). Resolution is browser-limited and not cross-origin isolated:
0.1 ms in Chromium, 1 ms in Playwright WebKit (visible in the raw data). The player position `p`
is `playerPositionChanged.currentTime`.

For a run, `aᵢ` is the arrival time of event *i* (handler start) and `pᵢ` its position. Only the
**steady state** is analysed: no seek events, from 1 s after the first event to 0.5 s before the
last (`steadyState`).

| Metric | Formula | Meaning |
|---|---|---|
| Expected interval `E` | `E = ⌈round(I · sr / 1000) / 128⌉ · 128 / sr · 1000`, `E = 128 / sr · 1000` for `I = 0` (`expectedInterval`) | The interval alphaTab can deliver: the setting `I` rounded up to whole 128-frame quanta at sample rate `sr` |
| Update interval | `Δaᵢ = aᵢ − aᵢ₋₁`; median, p95, p99, max | Event spacing as a consumer sees it |
| Interval deviation | `|Δaᵢ − E|`; median, p95, p99, max | Spacing error against `E` |
| Delayed / missed | delayed: `Δaᵢ > 1.5 E`; missed slots: `Σ (round(Δaᵢ / E) − 1)` over delayed intervals | Late or absent reports |
| Coalesced | `Δpᵢ > 1.5 E · r₀` | One event carrying more than one report's worth of audio |
| **Anchor jitter** (10 ms criterion) | fit `a ≈ α + β·p` (least squares over the steady state); `rᵢ = aᵢ − (α + β·pᵢ)`; jitter `= |rᵢ − median(r)|`; median, p95, p99, max (`anchorMetrics`) | How far an event arrives from where a constant-latency audio timeline puts it. The constant offset `α` (any fixed latency) and the rate `β` (drift) are removed, so **constant latency never counts as jitter** |
| Rate and drift | `r = 1 / β`; nominal `r₀` = 1 or the playback speed, whichever is closer to `r`; drift `= (r / r₀ − 1) · 10⁶` ppm; over the run `= drift · 10⁻⁶ · duration · r₀` ms | Audio clock vs `performance.now()` |
| Clock error at frames | reference `T(t) = (t − α) / β`; for every `requestAnimationFrame` time `tⱼ` in the steady state: `eⱼ = C(tⱼ) − T(tⱼ)`; bias `= median(e)`; error `= |eⱼ − bias|`; median, p95, p99, max (`clockError`) | What a visual consumer would see, per clock model `C` |

Clock models `C(t)` (`clockAt`), with `k` the last event with `aₖ ≤ t`:

- **raw:** `pₖ` (the last reported position, no interpolation);
- **interpolated:** `pₖ + (t − aₖ) · r₀` (MUSIC_ENGINE.md §5.1 without slew, latency and calibration);
- **regression:** a line fitted through `(a, p)` of the events of the last 500 ms, evaluated at `t`.

The reference `T` is derived from the same events. It stands for the audio-frame timeline,
because `p` counts frames the audio hardware consumed at a steady rate. It does **not** contain
the output latency to the speaker, so the clock error is an error against the player's audio
timeline, not against sound. Only the loopback measurement (§8) compares with sound.

**Browser-reported latency (not a measurement).** The harness records `AudioContext.baseLatency`,
`outputLatency` and, every frame, `getOutputTimestamp()` with `currentTime`; the reported lag is
`(currentTime − outputTimestamp.contextTime) · 1000`. These are the browser's own estimates and
are listed separately from measured values.

**Loopback (§8).** Onsets recorded from the audio input (an AudioWorklet threshold detector in a
separate AudioContext) are mapped to page time with a line through that context's
`(currentTime, performance.now())` pairs (`contextToPage`). For each onset at `tₖ`:
`errₖ = C(tₖ) − qₖ`, with `qₖ` the score time of the nearest note (one note per beat, 500 ms
apart at 120 BPM). **Latency** `= median(err)` (output + input + acoustic path, not separable
without calibration); **jitter** `= |errₖ − latency|`, p95 against the 10 ms criterion
(`loopbackErrors`). Matching to the nearest note requires a latency below 250 ms.

**Configurations** (each analysed on its own, never pooled): interval 10 ms (default) and 0 ms
at speed 1.0, three 60-s repeats each; interval 10 ms at speeds 0.5 and 1.5, one 60-s run each;
one 300-s run at 10 ms / 1.0 for drift. Browsers: Playwright Chromium and Playwright WebKit,
headless, one run at a time (`--workers=1`). The score is one piano note (eighth + eighth rest)
per beat at 120 BPM.

## 5. Environment and runs

| Item | Value |
|---|---|
| Host | MacBook (Intel Core i7-9750H, 2.6 GHz), macOS 26.7.3, built-in output |
| Node / Playwright | Node 26.13.1, Playwright 1.65.1, headless, one run at a time |
| Chromium | Playwright Chromium 159.0.8154.6 (`--autoplay-policy=no-user-gesture-required`); the user-agent string says Windows because Playwright's `Desktop Chrome` device preset sets it, the host is macOS |
| WebKit | Playwright WebKit ("Version/27.2" in the UA), not Safari |
| Firefox | Not run: Playwright's Firefox build is not installed and was not downloaded (owner instruction) |
| alphaTab | 1.9.0, worker player, audio-worklet output, sonivox.sf2; sample rate 48 kHz in all runs |
| Timer resolution in the data | Chromium 0.1 ms; WebKit 1 ms (smallest non-zero arrival difference) |
| Date | 2026‑11‑24, 18 runs in 27.2 min, all passed (`data/measure-run.log`); no run failed or was repeated |
| Harness change after the runs | `harness/index.html` was reformatted by Prettier (whitespace only) after the measurement; the smoke test passed again afterwards. The analysis code gained the wander, histogram and regression-window metrics after the runs; the raw data were not changed |

Raw data: `spikes/s6-audio-clock/data/raw/<browser>-i<interval>-s<speed>-d<seconds>-r<repeat>.json.gz`
(every event, every animation frame, AudioContext time pairs, `getOutputTimestamp()` samples, the
configuration, user agent, latency properties, host and recording time). Derived:
`data/summary.json` (all metrics per run, including interval histograms) and `data/summary.md`
(the tables below), both produced by `pnpm --filter @musichub/spike-s6-audio-clock analyze`.

## 6. Results (player-event timing; not audio output)

All values in ms. Each row is one run; nothing is pooled. "Jitter" is the anchor jitter of §4,
the metric used for the 10 ms criterion. "Raw / Interpolated / Regression" are p95 clock errors
at animation frames against the player's audio-frame timeline.

### 6.1 Per run

| Run | Browser | Interval | Speed | Dur s | Steady events | E ms | Δa median / p95 / p99 / max | |Δa−E| median / p95 / p99 / max | Delayed (missed slots) | Jitter median / p95 / p99 / max | Raw clock p95 | Interpolated p95 | Regression p95 | Drift ppm |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| raw/chromium-i0-s1-d60-r1.json.gz | chromium | 0 | 1 | 59.5 | 22314 | 2.67 | 1.20 / 5.40 / 5.60 / 10.80 | 2.67 / 2.73 / 2.93 / 8.13 | 11140 (11158) | 1.30 / 2.53 / 2.59 / 6.54 | 2.55 | 0.26 | 0.18 | 14.2 |
| raw/chromium-i0-s1-d60-r2.json.gz | chromium | 0 | 1 | 59.3 | 22254 | 2.67 | 1.10 / 5.50 / 5.80 / 22.30 | 2.67 / 2.83 / 3.13 / 19.63 | 11023 (11105) | 1.32 / 2.55 / 2.63 / 25.72 | 2.53 | 0.49 | 0.49 | 13.4 |
| raw/chromium-i0-s1-d60-r3.json.gz | chromium | 0 | 1 | 59.5 | 22314 | 2.67 | 1.20 / 5.50 / 6.00 / 16.20 | 2.67 / 2.83 / 3.33 / 13.53 | 11065 (11140) | 1.30 / 2.52 / 2.62 / 11.28 | 2.63 | 0.61 | 0.63 | 16.6 |
| raw/chromium-i10-s0.5-d60-r1.json.gz | chromium | 10 | 0.5 | 59.5 | 5578 | 10.67 | 10.70 / 11.10 / 11.50 / 20.00 | 0.13 / 0.63 / 1.07 / 9.33 | 2 (2) | 0.07 / 0.50 / 0.93 / 9.44 | 5.10 | 0.42 | 0.26 | 12.9 |
| raw/chromium-i10-s1-d300-r1.json.gz | chromium | 10 | 1 | 299.4 | 28069 | 10.67 | 10.70 / 11.20 / 11.70 / 26.80 | 0.13 / 0.67 / 1.33 / 16.13 | 16 (17) | 0.08 / 0.58 / 1.08 / 16.22 | 5.08 | 0.55 | 0.31 | 13.1 |
| raw/chromium-i10-s1-d60-r1.json.gz | chromium | 10 | 1 | 59.4 | 5569 | 10.67 | 10.70 / 10.90 / 11.50 / 19.70 | 0.07 / 0.43 / 1.17 / 9.03 | 2 (2) | 0.06 / 0.24 / 0.95 / 9.91 | 5.07 | 0.21 | 0.23 | 10.6 |
| raw/chromium-i10-s1-d60-r2.json.gz | chromium | 10 | 1 | 59.5 | 5579 | 10.67 | 10.70 / 11.30 / 12.00 / 73.90 | 0.13 / 0.93 / 2.17 / 63.23 | 8 (13) | 0.10 / 0.76 / 1.56 / 63.35 | 5.12 | 0.70 | 0.50 | 16.4 |
| raw/chromium-i10-s1-d60-r3.json.gz | chromium | 10 | 1 | 59.5 | 5578 | 10.67 | 10.70 / 11.00 / 11.60 / 20.50 | 0.07 / 0.67 / 1.17 / 9.83 | 4 (4) | 0.07 / 0.42 / 0.99 / 9.85 | 5.08 | 0.37 | 0.31 | 18.3 |
| raw/chromium-i10-s1.5-d60-r1.json.gz | chromium | 10 | 1.5 | 59.5 | 5578 | 10.67 | 10.70 / 11.20 / 11.70 / 21.00 | 0.17 / 0.77 / 1.23 / 10.33 | 4 (4) | 0.10 / 0.61 / 1.10 / 11.02 | 5.09 | 0.56 | 0.33 | 16 |
| raw/webkit-i0-s1-d60-r1.json.gz | webkit | 0 | 1 | 59.4 | 22238 | 2.67 | 3.00 / 6.00 / 10.00 / 56.00 | 0.67 / 3.33 / 7.33 / 53.33 | 1555 (2865) | 2.67 / 7.38 / 10.86 / 48.90 | 7.45 | 6.79 | 6.88 | -1031.3 |
| raw/webkit-i0-s1-d60-r2.json.gz | webkit | 0 | 1 | 59.3 | 22229 | 2.67 | 3.00 / 6.00 / 10.00 / 43.00 | 0.67 / 3.33 / 7.33 / 40.33 | 1573 (2856) | 3.18 / 8.87 / 10.81 / 40.72 | 9.01 | 7.89 | 7.82 | -704 |
| raw/webkit-i0-s1-d60-r3.json.gz | webkit | 0 | 1 | 59.4 | 22254 | 2.67 | 3.00 / 6.00 / 10.00 / 41.00 | 0.67 / 3.33 / 7.33 / 38.33 | 1668 (3092) | 2.01 / 5.79 / 9.19 / 38.31 | 6.07 | 4.58 | 4.80 | -765.6 |
| raw/webkit-i10-s0.5-d60-r1.json.gz | webkit | 10 | 0.5 | 59.4 | 5565 | 10.67 | 11.00 / 14.00 / 19.00 / 44.00 | 0.67 / 5.67 / 10.33 / 33.33 | 124 (130) | 2.79 / 8.06 / 11.87 / 26.27 | 9.86 | 7.54 | 7.06 | -879.7 |
| raw/webkit-i10-s1-d300-r1.json.gz | webkit | 10 | 1 | 299.7 | 28070 | 10.67 | 11.00 / 14.00 / 18.00 / 95.00 | 0.67 / 4.67 / 9.67 / 84.33 | 452 (508) | 4.32 / 12.73 / 16.22 / 90.30 | 13.95 | 12.39 | 12.08 | -837.4 |
| raw/webkit-i10-s1-d60-r1.json.gz | webkit | 10 | 1 | 59.6 | 5579 | 10.67 | 11.00 / 15.00 / 21.00 / 87.00 | 0.67 / 7.33 / 10.67 / 76.33 | 179 (206) | 3.82 / 14.37 / 17.65 / 68.52 | 14.66 | 13.49 | 12.98 | -1284.8 |
| raw/webkit-i10-s1-d60-r2.json.gz | webkit | 10 | 1 | 59.4 | 5549 | 10.67 | 11.00 / 14.00 / 20.00 / 307.00 | 0.67 / 5.67 / 10.67 / 296.33 | 132 (174) | 4.15 / 13.64 / 17.13 / 150.57 | 14.42 | 13.30 | 13.90 | -1336.3 |
| raw/webkit-i10-s1-d60-r3.json.gz | webkit | 10 | 1 | 59.2 | 5546 | 10.67 | 11.00 / 14.00 / 19.00 / 37.00 | 0.67 / 5.33 / 10.67 / 26.33 | 123 (134) | 2.92 / 9.69 / 12.58 / 29.42 | 11.01 | 9.27 | 8.56 | -719.6 |
| raw/webkit-i10-s1.5-d60-r1.json.gz | webkit | 10 | 1.5 | 59.4 | 5563 | 10.67 | 11.00 / 14.00 / 18.00 / 29.00 | 0.67 / 5.33 / 9.67 / 18.33 | 122 (127) | 3.16 / 8.65 / 11.84 / 19.83 | 10.27 | 8.47 | 7.63 | -1094.1 |

### 6.2 Per configuration (range of the per-run statistics; repeats are not pooled)

| Configuration | Runs | Jitter p95 (per-run range) | Jitter p99 | Jitter max | Interpolated p95 | Raw p95 | Drift ppm |
|---|---|---|---|---|---|---|---|
| chromium interval 0 speed 1 60s | 3 | 2.52–2.55 | 2.59–2.63 | 6.54–25.72 | 0.26–0.61 | 2.53–2.63 | 13.40–16.60 |
| chromium interval 10 speed 0.5 60s | 1 | 0.50 | 0.93 | 9.44 | 0.42 | 5.10 | 12.90 |
| chromium interval 10 speed 1 300s | 1 | 0.58 | 1.08 | 16.22 | 0.55 | 5.08 | 13.10 |
| chromium interval 10 speed 1 60s | 3 | 0.24–0.76 | 0.95–1.56 | 9.85–63.35 | 0.21–0.70 | 5.07–5.12 | 10.60–18.30 |
| chromium interval 10 speed 1.5 60s | 1 | 0.61 | 1.10 | 11.02 | 0.56 | 5.09 | 16.00 |
| webkit interval 0 speed 1 60s | 3 | 5.79–8.87 | 9.19–10.86 | 38.31–48.90 | 4.58–7.89 | 6.07–9.01 | -1031.30–-704.00 |
| webkit interval 10 speed 0.5 60s | 1 | 8.06 | 11.87 | 26.27 | 7.54 | 9.86 | -879.70 |
| webkit interval 10 speed 1 300s | 1 | 12.73 | 16.22 | 90.30 | 12.39 | 13.95 | -837.40 |
| webkit interval 10 speed 1 60s | 3 | 9.69–14.37 | 12.58–17.65 | 29.42–150.57 | 9.27–13.49 | 11.01–14.66 | -1336.30–-719.60 |
| webkit interval 10 speed 1.5 60s | 1 | 8.65 | 11.84 | 19.83 | 8.47 | 10.27 | -1094.10 |

### 6.3 Interval 0: full interval distribution

Chromium, run `i0-s1-d60-r1` (22,313 intervals, 0.5 ms bins): `0–0.5`: 11,142 · `0.5–4.5`:
57 · `4.5–5`: 143 · `5–5.5`: 9,984 · `5.5–6`: 936 · `6–8`: 47 · `≥ 8`: 4. Half of the events
arrive within 0.5 ms of the previous one: the worklet reports every quantum, but the reports
reach the page in pairs. The "delayed" count (11,140) and the interval deviation (median 2.67
ms) in §6.1 reflect this pairing, not lost audio; `coalesced` is 0 and the anchor jitter stays at
p95 2.5 ms, about half the pair period. Practical effect: the raw position improves from ~5.1 to
~2.6 ms p95 error, but the interpolated clock gains nothing over 10 ms (0.26–0.61 vs 0.21–0.70
ms p95), while the message rate between audio thread, worker and page is about four times higher.

WebKit, run `i0-s1-d60-r1` (1 ms bins, the timer resolution): `0`: 2,733 · `1`: 518 · `2`:
5,859 · `3`: 10,877 · `4`: 695 · `5`: 377 · `6`: 305 · `7`: 215 · `≥ 8`: 658. WebKit
values are whole milliseconds; an interval of 2.67 ms is recorded as 2 or 3 ms. The quantisation
adds at most ±0.5 ms per timestamp (≤ 1 ms per interval). It is far below the WebKit jitter
measured here, but WebKit's sub-millisecond figures (medians, the interval deviation) cannot be
compared with Chromium's 0.1 ms data as equals.

### 6.4 Fallback candidate: longer regression windows (same data, same reference)

| Run | Interpolated p95 / p99 | Regression 250 ms p95 / p99 | 500 ms | 1000 ms | 2000 ms |
|---|---|---|---|---|---|
| raw/chromium-i0-s1-d60-r1.json.gz | 0.26 / 0.91 | 0.19 / 0.33 | 0.18 / 0.28 | 0.18 / 0.25 | 0.19 / 0.23 |
| raw/chromium-i0-s1-d60-r2.json.gz | 0.49 / 2.60 | 0.45 / 1.40 | 0.49 / 1.42 | 0.52 / 1.35 | 0.62 / 1.41 |
| raw/chromium-i0-s1-d60-r3.json.gz | 0.61 / 1.95 | 0.61 / 1.08 | 0.63 / 1.07 | 0.52 / 1.02 | 0.47 / 1.08 |
| raw/chromium-i10-s0.5-d60-r1.json.gz | 0.42 / 0.81 | 0.27 / 0.51 | 0.26 / 0.46 | 0.25 / 0.36 | 0.23 / 0.28 |
| raw/chromium-i10-s1-d300-r1.json.gz | 0.55 / 0.92 | 0.33 / 0.67 | 0.31 / 0.57 | 0.30 / 0.55 | 0.30 / 0.50 |
| raw/chromium-i10-s1-d60-r1.json.gz | 0.21 / 0.82 | 0.25 / 0.51 | 0.23 / 0.48 | 0.20 / 0.37 | 0.18 / 0.31 |
| raw/chromium-i10-s1-d60-r2.json.gz | 0.70 / 1.23 | 0.52 / 1.47 | 0.50 / 1.94 | 0.48 / 2.88 | 0.46 / 2.28 |
| raw/chromium-i10-s1-d60-r3.json.gz | 0.37 / 0.88 | 0.34 / 0.62 | 0.31 / 0.47 | 0.28 / 0.40 | 0.28 / 0.35 |
| raw/chromium-i10-s1.5-d60-r1.json.gz | 0.56 / 1.01 | 0.34 / 0.64 | 0.33 / 0.51 | 0.32 / 0.42 | 0.29 / 0.41 |
| raw/webkit-i0-s1-d60-r1.json.gz | 6.79 / 8.04 | 7.30 / 9.22 | 6.88 / 8.98 | 7.00 / 9.30 | 7.32 / 10.45 |
| raw/webkit-i0-s1-d60-r2.json.gz | 7.89 / 9.66 | 8.25 / 9.99 | 7.82 / 9.83 | 8.00 / 10.40 | 8.95 / 10.35 |
| raw/webkit-i0-s1-d60-r3.json.gz | 4.58 / 5.55 | 5.32 / 6.61 | 4.80 / 6.07 | 4.93 / 6.31 | 5.02 / 5.97 |
| raw/webkit-i10-s0.5-d60-r1.json.gz | 7.54 / 10.69 | 7.66 / 10.63 | 7.06 / 9.06 | 6.62 / 8.74 | 6.28 / 11.19 |
| raw/webkit-i10-s1-d300-r1.json.gz | 12.39 / 15.49 | 12.50 / 16.11 | 12.08 / 15.65 | 12.14 / 15.31 | 12.02 / 15.86 |
| raw/webkit-i10-s1-d60-r1.json.gz | 13.49 / 16.74 | 13.81 / 17.75 | 12.98 / 16.98 | 12.78 / 15.95 | 12.73 / 15.97 |
| raw/webkit-i10-s1-d60-r2.json.gz | 13.30 / 16.39 | 13.98 / 46.45 | 13.90 / 70.91 | 14.17 / 68.25 | 15.54 / 68.19 |
| raw/webkit-i10-s1-d60-r3.json.gz | 9.27 / 11.35 | 9.46 / 12.15 | 8.56 / 10.98 | 8.57 / 10.19 | 8.79 / 10.53 |
| raw/webkit-i10-s1.5-d60-r1.json.gz | 8.47 / 11.29 | 8.45 / 10.76 | 7.63 / 10.09 | 7.28 / 10.01 | 7.20 / 10.79 |

### 6.5 Slow wander of the event timeline

| Run | Jitter p95 | Wander (1 s lower-envelope range) | AudioContext.currentTime residual p95 |
|---|---|---|---|
| raw/chromium-i0-s1-d60-r1.json.gz | 2.53 | 0.20 | 2.62 |
| raw/chromium-i0-s1-d60-r2.json.gz | 2.55 | 0.25 | 2.62 |
| raw/chromium-i0-s1-d60-r3.json.gz | 2.52 | 0.44 | 2.61 |
| raw/chromium-i10-s0.5-d60-r1.json.gz | 0.50 | 0.20 | 2.72 |
| raw/chromium-i10-s1-d300-r1.json.gz | 0.58 | 0.28 | 2.54 |
| raw/chromium-i10-s1-d60-r1.json.gz | 0.24 | 0.25 | 2.88 |
| raw/chromium-i10-s1-d60-r2.json.gz | 0.76 | 0.29 | 2.81 |
| raw/chromium-i10-s1-d60-r3.json.gz | 0.42 | 0.32 | 2.59 |
| raw/chromium-i10-s1.5-d60-r1.json.gz | 0.61 | 0.25 | 2.61 |
| raw/webkit-i0-s1-d60-r1.json.gz | 7.38 | 14.14 | 7.03 |
| raw/webkit-i0-s1-d60-r2.json.gz | 8.87 | 16.20 | 8.31 |
| raw/webkit-i0-s1-d60-r3.json.gz | 5.79 | 9.21 | 4.96 |
| raw/webkit-i10-s0.5-d60-r1.json.gz | 8.06 | 13.63 | 6.45 |
| raw/webkit-i10-s1-d300-r1.json.gz | 12.73 | 30.37 | 11.86 |
| raw/webkit-i10-s1-d60-r1.json.gz | 14.37 | 25.18 | 12.13 |
| raw/webkit-i10-s1-d60-r2.json.gz | 13.64 | 153.52 | 11.64 |
| raw/webkit-i10-s1-d60-r3.json.gz | 9.69 | 17.04 | 7.86 |
| raw/webkit-i10-s1.5-d60-r1.json.gz | 8.65 | 13.95 | 6.78 |

"Wander" is the range of the per-second smallest residual (lower envelope). White delivery jitter
leaves it flat (Chromium 0.2–0.44 ms); in WebKit it moves by 9–30 ms (153 ms in the run with a
307 ms stall). `AudioContext.currentTime` read on the main thread wanders in WebKit by a similar
amount (residual p95 5–12 ms), whereas in Chromium its residual (~2.6 ms) is the step size of
`currentTime` itself.

### 6.6 Browser-reported latency (reported, not measured)

| Browser | `baseLatency` | `outputLatency` | `currentTime − getOutputTimestamp().contextTime` (median) |
|---|---|---|---|
| Chromium | 5.33 ms | 24.00 ms | 26.4 ms |
| WebKit | 2.67 ms | 8.94 ms | 0 ms (no usable estimate) |

These are the browsers' own numbers for headless Playwright on this Mac; they are neither a
loopback measurement nor a basis for calibration.

## 7. Interpretation

### 7.1 Chromium

Events are delivered on schedule (interval deviation p95 ≤ 0.93 ms at 10 ms) with rare stalls
(one interval of 73.9 ms in 9 runs). The interpolated clock tracks the audio-frame timeline within
0.21–0.70 ms p95 and ≤ 2.6 ms p99, at all three speeds and over 300 s. Drift +10…+18 ppm.

### 7.2 WebKit

The jitter is not random per-event delay: its lower envelope moves over seconds (wander 9–30 ms),
and `AudioContext.currentTime` moves with it. This is consistent with an audio render clock that
is not paced steadily against `performance.now()` in headless Playwright WebKit, together with
the −0.07…−0.13 % rate. A longer regression window does not remove it (§6.4), because the
reference itself is the straight line the wander departs from. Which of the two clocks matches
the sound at the speaker is not knowable without loopback: if the sound follows the audio clock,
an audio-anchored clock is right to follow the wander, and the "error" is the reference's.
Interval 0 reduces WebKit's p95 from 9.69–14.37 to 5.79–8.87 ms (p99 up to 10.86).

### 7.3 Speed and `currentTime`

At speeds 0.5, 1.0 and 1.5, `currentTime` advances at 1.000 ms per ms in every run, while
`currentTick` advances at 0.96, 1.92 and 2.88 ticks per ms (120 BPM, 960 PPQ). **`currentTime` is
elapsed playback time, not score time.** MUSIC_ENGINE.md §5.1 takes `anchor.scoreMs` from
`currentTime` and multiplies the extrapolation by `speed`; with alphaTab 1.9.0 the score position
has to come from `currentTick` (or `currentTime × speed` from the playback start), and the
extrapolation rate for `currentTime` is 1. Recorded as a finding for Phase 1; the resulting
recommendation is provisional (§9.2).

### 7.4 What is not shown

None of these numbers prove synchronisation with sound. They show how well a clock built from
`playerPositionChanged` follows the player's own audio-frame count. The output latency, its
jitter, and whether the frame count matches the speaker are open until a loopback run (§8).

## 8. Independent audio reference (loopback): availability and setup notes (not performed)

**Available on the measurement machine** (macOS 26.7.3, Intel i7-9750H; `system_profiler
SPAudioDataType`): built-in output (2 channels) and built-in microphone (1 channel). No
BlackHole or other virtual loopback driver and no audio interface are installed
(`/Library/Audio/Plug-Ins/HAL` contains only `ParrotAudioPlugin.driver`, which is not a
loopback device). Headless Playwright cannot record its own output, and installing drivers or
downloading Playwright's Firefox needs the owner's consent. **No loopback measurement was made
by the agent**, and by decision of the owner (2026‑11‑24) none is planned in the current scope.
The paths and steps below are kept as setup notes for a later task; they are not pending work of
S2-08.

Possible reference paths:

| Path | Needs | Measures | Notes |
|---|---|---|---|
| Acoustic loopback | Built-in speaker → built-in microphone, quiet room | Output + acoustic + input latency (constant) and jitter | Available now; noisiest; volume high enough for clear onsets |
| Cable loopback | Audio interface (or headphone-out → line-in) and a cable from output to input | Output + input latency and jitter | Cleanest physical reference |
| BlackHole (virtual) | BlackHole 2ch installed, set as output and selected as microphone | The software path up to the CoreAudio device; **not** the DAC/speaker latency | Jitter only; hardware latency is excluded |

Run procedure, for a later task (any path):

1. `pnpm --filter @musichub/spike-s6-audio-clock serve` and open
   `http://127.0.0.1:3280/?interval=10&seconds=60&loopback=1` in the browser to test (Chrome,
   Safari, Firefox).
2. Set the output volume so the notes are clearly audible at the microphone; keep the room quiet.
   For BlackHole, set system output to BlackHole and pick BlackHole as the input in the permission
   prompt.
3. Click **Start measurement** and allow microphone access. Do not touch the page for the
   duration of the run.
4. When the status shows `"done": true`, click **Download raw data** and put the file in
   `spikes/s6-audio-clock/data/loopback/` (it can stay uncompressed `.json`).
5. Repeat with `interval=0`. Note the browser, its version, the path (acoustic, cable,
   BlackHole) and the output device in the file name or the PR.
6. `pnpm --filter @musichub/spike-s6-audio-clock analyze` adds a loopback row (latency and
   jitter) for every file in `data/loopback/`.

Acceptance against sound: loopback jitter p95 < 10 ms. The latency median is recorded for the
Phase 2 calibration table, not corrected here.

## 9. Conclusion

**Verdict: insufficient evidence. The Phase 0 criterion "S6 clock jitter < 10 ms, or a fallback
is chosen" is not verified.** The measurements cover alphaTab's event timing against the browser's
audio-frame clock, in two Playwright engines. They do not cover sound at the output, Safari on a
real device or Firefox, and in headless WebKit the default setting fails.

### 9.1 Confirmed (directly by the measurements in §6)

1. alphaTab 1.9.0 reports the played position in steps of whole 128-frame render quanta:
   every 10.67 ms at the default 10 ms, every 2.67 ms at 0 ms (48 kHz, source §3 and §6).
2. **Playwright Chromium, headless:** p95 anchor jitter 0.24–0.76 ms at 10 ms and 2.52–2.55 ms
   at 0 ms, below 10 ms in 9/9 runs, at speeds 0.5/1.0/1.5 and over 300 s. Repeats are
   consistent.
3. **Playwright WebKit, headless:** p95 anchor jitter **above 10 ms at the default 10 ms in 3 of 4
   speed-1.0 runs** (12.73, 13.64, 14.37 ms; 9.69 ms in the fourth); below 10 ms at speeds 0.5
   (8.06) and 1.5 (8.65), one run each, and at 0 ms in 3/3 runs (5.79–8.87 ms, p99 up to
   10.86 ms). Repeats vary.
4. In Chromium the interpolated clock (MUSIC_ENGINE.md §5.1 without slew) reduces the p95 error
   against the audio-frame timeline from ≈ 5.1 ms (raw position) to 0.21–0.70 ms. At 0 ms Chromium
   delivers the reports in pairs (effective period ≈ 5.3 ms) and the interpolated clock gains
   nothing over 10 ms, with about four times as many events.
5. In WebKit neither interpolation nor regression windows up to 2 s bring the error below the
   jitter: the event timeline wanders by 9–30 ms over seconds (153 ms in one run with a 307 ms
   stall), and `AudioContext.currentTime` read on the page wanders by a similar amount.
6. Drift against `performance.now()`: Chromium +10.6…+18.3 ppm; WebKit −704…−1336 ppm.
7. `currentTime` is elapsed playback time at every speed; `currentTick` scales with the speed.

### 9.2 Provisional (follows from the results, needs further checks)

1. Take the score position from `currentTick`, not from `currentTime` (recorded in
   MUSIC_ENGINE.md §5.1). Confirmed for alphaTab 1.9.0 in both engines; to be re-checked in
   Phase 1 with the real `PlaybackClock`.
2. Keep `positionUpdateIntervalInMilliseconds = 10` as the base setting for Chromium.
3. Consider `0` as a possible fallback for WebKit: it was the only tested setting with p95 < 10 ms
   in headless WebKit. **Not a decision for Safari:** real Safari was not measured, p99 still
   exceeded 10 ms in 2/3 runs, and it costs about four times the messages.
4. Keep the interpolated, audio-anchored clock of MUSIC_ENGINE.md §5.1 and its 30 ms snap rule
   (the WebKit wander would otherwise cause visible jumps). Regression smoothing is not a fallback
   (§6.4).

### 9.3 Not confirmed (needs measurements that were not made)

1. Real audio output latency and jitter at the speaker (needs loopback).
2. Whether the clock matches the sound in any browser; whether WebKit's wander is the sound's
   timing or an artefact of headless Playwright (needs loopback and headed runs).
3. Safari on a real device (Playwright WebKit is not equivalent).
4. Firefox (not run).
5. The PIANO_VISUALIZER.md §5 plan in full: 5-minute runs at 0.5/1.0/1.5 in Chrome, Firefox and
   Safari (this spike ran 60-s runs at 0.5 and 1.5 and one 300-s run at 1.0 per engine).
6. The MUSIC_ENGINE.md §10 S6 criterion "interpolated clock error < 10 ms vs a reference
   (Playwright + audio loopback, or manual metronome tap test)": the reference here is the
   player's own audio-frame timeline, not loopback or a tap test.
7. That the Phase 0 criterion holds for all supported browsers.

## 10. Limitations

- **What was measured:** the arrival time of alphaTab's `playerPositionChanged` on the page
  against the position it reports, which counts frames the browser's audio worklet consumed. This
  is the browser-reported audio clock as alphaTab sees it, not physical audio output.
- **No loopback** was performed; output latency and jitter at the speaker are not measured. The
  latency values in §6.6 are the browsers' own reports.
- **Playwright WebKit** is Playwright's engine build in headless mode, not Safari on a real
  device; its `performance.now()` has 1 ms resolution, so its sub-millisecond figures are not
  comparable with Chromium's 0.1 ms data.
- **Firefox** was not checked (Playwright's Firefox build not installed; download not approved).
- **Headless only**, one Intel Mac, one alphaTab version (1.9.0, pinned), one simple score.
- The WebKit results at the default 10 ms interval are negative (3 of 4 speed-1.0 runs above
  10 ms) and stay part of the result.
- The results do **not** show that the Phase 0 criterion is met for all supported browsers.

No ADR records a decision from this spike: the evidence is not sufficient. ADR-0004 carries a
short addendum with the status *Deferred* (findings and limitations only).

Validation (2026‑11‑24, agent): `pnpm format:check` clean; `pnpm depcruise` no violations
(137 modules); `pnpm turbo run lint typecheck test build` 24/24 tasks (spike S6: 15 unit tests);
`pnpm test:browser` in the spike 4 passed (Chromium, WebKit).

## 11. Scope and open items

By decision of the owner (2026‑11‑24), the current S2-08 scope ends with the automated
measurements and this report. Loopback runs, Safari and Firefox runs, headed runs and the full
PIANO_VISUALIZER.md §5 plan are **not part of the current scope** and are not scheduled. They are
the evidence a later task needs before the Phase 0 clock criterion can be decided:

1. Loopback (§8): latency median and jitter p95 against sound, at least Chrome and Safari,
   intervals 10 and 0.
2. Safari on a real device and Firefox player-event runs.
3. Headed runs with a real output device (is WebKit's wander a headless artefact?).
4. A decision on the fallback for WebKit/Safari, or on another fallback, once 1–3 exist.

Calibration (Phase 2) is out of scope.
