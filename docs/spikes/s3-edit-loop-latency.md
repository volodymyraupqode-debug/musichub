# Spike S3 — Edit-loop latency (ROADMAP S2-10)

> Status: **partly done.** Edit-loop latency measured in Playwright Chromium and WebKit (headless,
> macOS) on three document sizes and five fallback variants. The < 150 ms target is met for the
> small document only; for 50 bars × 8 tracks it is borderline (Chromium) or missed (WebKit), for
> 300 bars × 8 tracks it is missed by every measured variant. **No fallback reaches the target on
> the large document, so none is selected.** Player position preservation works.

## 1. Question and acceptance criteria

MUSIC_ENGINE.md §10, S3: "Edit-loop latency: re-render after single note change; player position
preservation", done when "Measured numbers recorded in ADR; < 150 ms target or fallback selected".
MUSIC_ENGINE.md §6 defines the loop:

```
editor-core command ─▶ new immutable MHD (structural sharing)
  ─▶ RenderScheduler (coalesce per animation frame, min 50 ms between renders while typing)
  ─▶ toAlphaTab(doc, visibleTrackIds) ─▶ score.finish() ─▶ api.renderScore(score, trackIndexes)
  ─▶ renderFinished ─▶ rebuild hit-test index from boundsLookup ─▶ redraw caret/selection overlay
```

It also requires that "re-render latency including MIDI regeneration is measured in S3", that an
edit during playback stores `tickPosition` and restores it after `midiLoaded`, and names three
fallbacks "if spike S3 shows unacceptable latency on 300-bar scores": Horizontal layout, a render
window via `display.startBar`/`barCount`, rendering the edited track only.

### 1.1 Ambiguities in the definition (not resolved here)

| # | Open in the documentation | How this spike handles it |
|---|---|---|
| A1 | Start point: key press, command, or new MHD? | t0 = start of the edit command (the user's input event and the RenderScheduler are not part of the measurement, §2) |
| A2 | End point: `renderFinished`, painted frame, or the edited bar drawn? | All three are measured and reported separately |
| A3 | Statistic for "< 150 ms": median, p95 or maximum? | Median, p95, maximum and the count above 150 ms are reported; the verdict is given for p95 and for the median separately |
| A4 | Document size the target applies to | Three sizes (8 × 4, 50 × 8, 300 × 8); §6 only names 300-bar scores for the fallbacks |
| A5 | Which tracks are visible | All tracks (baseline) and edited track only (fallback 3) |

The owner decides A1–A5; this report does not choose them.

## 2. Method

**Pipeline under test:** the real S2 Strategy A adapter (`toAlphaTabDirect`, Render and Playback
Score), the real S7 `midiLoad` hook, and the real `AlphaTabApi` (alphaTab 1.9.0, render worker,
SoundFont, player) in a plain HTML page (`spikes/s2-mhd-to-alphatab/e2e/edit-loop-harness.html`).
The adapter and hook are loaded from their TypeScript sources with the types stripped by Node
(`e2e/edit-loop-server.ts`), `@musichub/music-model` from its build output and zod from its ESM
files; no bundler and no copy of the code.

**Modelled, not real:** the edit command (`src/edit-loop/edit.ts`) is a model of a single-note
`editor-core` command (a new immutable MHD with structural sharing; ±1 fret on stringed staves,
±1 pitch otherwise); `editor-core` does not exist yet. The RenderScheduler (frame coalescing and
the 50 ms throttle while typing) is **not** modelled: it would add up to one frame (≈ 16.7 ms) per
edit, and up to 50 ms during fast typing, on top of the numbers here. Input-event latency and the
caret overlay are not measured; the hit-test step walks the bounds lookup as a stand-in.

**Timestamps** (`performance.now()`, main thread), per edit:

| Point | Meaning |
|---|---|
| t0 | edit command starts |
| edit | t0 → new MHD |
| convert | new MHD → Render + Playback Score, `finish()` |
| renderScore call | duration of `api.renderScore()` on the main thread: posts the Score to the worker **and** regenerates the MIDI (alphaTab's `loadMidiForScore` + the S7 hook's Playback MIDI) |
| t0 → renderFinished | `api.renderFinished`: whole sheet laid out, visible partial images requestable (lazy loading is on, alphaTab's default) |
| hit-test | walk of `renderer.boundsLookup` after `renderFinished` |
| t0 → next frame | first `requestAnimationFrame` after the hit-test step: the earliest frame that can show the update |
| t0 → edited bar drawn | first `partialRenderFinished` whose bar range contains the edited bar |
| t0 → midiLoaded | `api.midiLoaded`: the player has the new MIDI |

**Runs:** per scenario one page, 3 warm-up edits (recorded, excluded from the statistics) and 30
measured edits, 200 ms idle between edits, runs serial (`--workers=1`). Edits target notes of
track 0, cycling through a fixed list.

**Scenarios:** small = canonical `band-repeats` (8 bars × 4 tracks); medium =
`performanceDocument(50)` (50 × 8); large = `performanceDocument(300)` (300 × 8, the S2 benchmark
document). Variants: baseline (all tracks, page layout), **track** (edited track only), **horizontal**
(`LayoutMode.Horizontal`), **window** (`display.startBar`/`barCount` = 16 bars around the caret),
**nomidi** (render through `api.renderer.renderScore()`, which does not regenerate MIDI; a measured
candidate beyond the §6 list), **window-nomidi** (both).

**Correction during the spike (kept visible):** the first run edited bars 2–9, assuming they are on
the first screen. In the 8-track documents only the first system fits a 720 px viewport, so those
bars were never drawn and "edited bar drawn" could not be observed (`n/a` in §4). These runs are kept
unchanged; the same scenarios were then added with edits in bars 0–1 (column "Edited bars"), and the
nomidi variants were measured only with bars 0–1.

**Environment:** MacBook, Intel Core i7-9750H, 16 GB, macOS 26.7.3; Node 26.13.1; Playwright 1.65.1
Chromium and WebKit, headless, viewport 1280 × 720; alphaTab 1.9.0 with `useWorkers` and lazy
loading. 2026‑11‑24.

**Reproduce:** `S3_MEASURE=1 pnpm --filter @musichub/spike-s2-mhd-to-alphatab exec playwright test
e2e/edit-loop-measure.spec.ts --workers=1`, then `pnpm --filter @musichub/spike-s2-mhd-to-alphatab
edit-loop-analyze`. Raw data: `spikes/s2-mhd-to-alphatab/data/edit-loop/*.json.gz` (every record
with metadata), logs `measure-run*.log`, derived `summary.json`/`summary.md`.

## 3. Results — Node decomposition (stage costs only, not latency)

Node 26, no browser, renderer or player (`pnpm edit-loop-node`): the cost of the edit, the
conversion, and MIDI generation as `loadMidiForScore` (Render Score) and the S7 hook (Playback
Score) perform it. Milliseconds.

| Document | Bars × tracks | n | Edit median / p95 | Convert median / p95 / max | Render-Score MIDI median / p95 | Playback-Score MIDI (hook) median / p95 |
|---|---|---|---|---|---|---|
| small | 8 × 4 | 30 | 0.01 / 0.03 | 1.0 / 5.6 / 6.8 | 0.4 / 8.0 | 0.4 / 3.1 |
| medium | 50 × 8 | 30 | 0.01 / 0.02 | 28.7 / 54.7 / 55.1 | 34.9 / 58.9 | 31.5 / 49.7 |
| large | 300 × 8 | 30 | 0.02 / 0.04 | 173.3 / 272.2 / 289.7 | 200.9 / 233.0 | 206.1 / 246.9 |

## 4. Results — browser edit loop (measured)

Values in ms: median / p95 / max / count > 150 ms. Times from t0 (edit start) unless noted.

| Browser | Document | Variant | Edited bars | n | Convert (stage) | renderScore call (stage) | t0 → renderFinished | t0 → next frame | t0 → edited bar drawn | t0 → midiLoaded |
|---|---|---|---|---|---|---|---|---|---|---|
| chromium | large | baseline | 0–1 | 30 | 83.0 / 152.9 / 189.3 / 2 | 296.7 / 509.5 / 636.1 / 30 | 532.4 / 709.1 / 1160.5 / 30 | 534.5 / 725.7 / 1173.4 / 30 | 548.5 / 762.0 / 1172.4 / 30 | 433.6 / 654.8 / 875.5 / 30 |
| chromium | large | baseline | 2–9 | 30 | 76.8 / 111.5 / 154.1 / 1 | 234.7 / 539.2 / 545.1 / 30 | 509.8 / 884.4 / 924.1 / 30 | 518.6 / 902.5 / 936.9 / 30 | n/a (30 not seen) | 393.9 / 664.4 / 720.6 / 30 |
| chromium | large | horizontal | 2–9 | 30 | 77.3 / 224.2 / 282.1 / 5 | 517.6 / 933.7 / 1072.0 / 30 | 755.0 / 1309.9 / 1426.9 / 30 | 767.1 / 1377.3 / 1440.0 / 30 | 1291.0 / 2110.5 / 2357.4 / 30 | 766.9 / 1377.1 / 1434.6 / 30 |
| chromium | large | nomidi | 0–1 | 30 | 65.5 / 81.6 / 83.0 / 0 | 36.5 / 48.7 / 111.8 / 0 | 492.7 / 600.7 / 631.9 / 30 | 498.8 / 609.1 / 636.9 / 30 | 508.1 / 642.0 / 646.1 / 30 | n/a |
| chromium | large | track | 2–9 | 30 | 86.9 / 166.6 / 198.6 / 2 | 368.0 / 618.0 / 706.5 / 30 | 452.9 / 790.2 / 826.9 / 30 | 464.9 / 801.5 / 853.4 / 30 | 472.3 / 798.9 / 874.4 / 30 | 502.0 / 812.7 / 865.3 / 30 |
| chromium | large | window | 0–1 | 30 | 79.9 / 151.4 / 204.5 / 2 | 343.0 / 531.6 / 532.3 / 30 | 439.3 / 610.8 / 620.4 / 30 | 477.9 / 630.9 / 633.8 / 30 | 462.3 / 626.2 / 638.2 / 30 | 491.0 / 640.2 / 645.4 / 30 |
| chromium | large | window-nomidi | 0–1 | 30 | 74.4 / 140.6 / 185.1 / 1 | 40.5 / 123.4 / 164.6 / 1 | 232.8 / 350.8 / 366.2 / 30 | 244.1 / 352.0 / 372.9 / 30 | 238.8 / 356.2 / 372.8 / 30 | n/a |
| chromium | large | window | 2–9 | 30 | 75.3 / 96.3 / 97.8 / 0 | 275.7 / 403.8 / 501.4 / 30 | 351.2 / 577.9 / 621.8 / 30 | 384.7 / 588.0 / 622.0 / 30 | n/a (30 not seen) | 387.0 / 601.9 / 622.9 / 30 |
| chromium | medium | baseline | 0–1 | 30 | 7.3 / 9.5 / 12.8 / 0 | 39.5 / 59.3 / 67.2 / 0 | 83.2 / 178.8 / 213.0 / 2 | 97.9 / 185.3 / 229.0 / 3 | 88.7 / 183.2 / 219.5 / 4 | 55.1 / 78.2 / 87.5 / 0 |
| chromium | medium | baseline | 2–9 | 30 | 7.4 / 10.6 / 11.5 / 0 | 43.6 / 49.0 / 53.8 / 0 | 77.9 / 136.4 / 175.3 / 1 | 83.7 / 147.4 / 190.9 / 1 | n/a (30 not seen) | 56.9 / 73.1 / 74.8 / 0 |
| chromium | medium | nomidi | 0–1 | 30 | 7.1 / 11.7 / 14.5 / 0 | 6.5 / 7.8 / 12.2 / 0 | 69.1 / 164.1 / 194.1 / 3 | 76.7 / 166.4 / 195.8 / 3 | 73.9 / 168.5 / 199.6 / 3 | n/a |
| chromium | small | baseline | 2–9 | 30 | 0.7 / 1.1 / 1.4 / 0 | 1.0 / 1.6 / 1.9 / 0 | 5.7 / 11.2 / 11.3 / 0 | 15.9 / 21.5 / 21.6 / 0 | 19.9 / 26.3 / 26.3 / 0 | 2.2 / 4.3 / 4.9 / 0 |
| webkit | large | baseline | 0–1 | 30 | 68.0 / 120.0 / 131.0 / 0 | 327.0 / 654.0 / 920.0 / 30 | 585.0 / 1299.0 / 1339.0 / 30 | 619.0 / 1312.0 / 1521.0 / 30 | 616.0 / 1360.0 / 2333.0 / 30 | 453.0 / 799.0 / 1073.0 / 30 |
| webkit | large | baseline | 2–9 | 30 | 104.0 / 269.0 / 493.0 / 8 | 481.0 / 778.0 / 788.0 / 30 | 910.0 / 1770.0 / 1801.0 / 30 | 977.0 / 1770.0 / 1821.0 / 30 | n/a (30 not seen) | 647.0 / 1146.0 / 1171.0 / 30 |
| webkit | large | horizontal | 2–9 | 30 | 83.0 / 367.0 / 465.0 / 11 | 380.0 / 898.0 / 912.0 / 30 | 904.0 / 2007.0 / 2755.0 / 30 | 930.0 / 2015.0 / 2776.0 / 30 | 1905.0 / 3211.0 / 4686.0 / 30 | 615.0 / 1324.0 / 1407.0 / 30 |
| webkit | large | nomidi | 0–1 | 30 | 73.0 / 240.0 / 305.0 / 3 | 53.0 / 151.0 / 166.0 / 2 | 564.0 / 944.0 / 2934.0 / 30 | 573.0 / 994.0 / 2948.0 / 30 | 576.0 / 980.0 / 2969.0 / 30 | n/a |
| webkit | large | track | 2–9 | 30 | 89.0 / 159.0 / 298.0 / 4 | 422.0 / 770.0 / 1296.0 / 30 | 542.0 / 866.0 / 1636.0 / 30 | 546.0 / 876.0 / 1640.0 / 30 | 572.0 / 901.0 / 1664.0 / 30 | 621.0 / 894.0 / 1640.0 / 30 |
| webkit | large | window | 0–1 | 30 | 77.0 / 166.0 / 216.0 / 3 | 246.0 / 659.0 / 748.0 / 30 | 359.0 / 822.0 / 873.0 / 30 | 363.0 / 826.0 / 874.0 / 30 | 382.0 / 844.0 / 1008.0 / 30 | 388.0 / 873.0 / 1027.0 / 30 |
| webkit | large | window-nomidi | 0–1 | 30 | 68.0 / 139.0 / 166.0 / 1 | 40.0 / 103.0 / 119.0 / 0 | 251.0 / 327.0 / 369.0 / 30 | 255.0 / 339.0 / 381.0 / 30 | 264.0 / 376.0 / 415.0 / 30 | n/a |
| webkit | large | window | 2–9 | 30 | 75.0 / 153.0 / 174.0 / 2 | 306.0 / 442.0 / 527.0 / 30 | 408.0 / 599.0 / 758.0 / 30 | 410.0 / 600.0 / 760.0 / 30 | n/a (30 not seen) | 447.0 / 744.0 / 759.0 / 30 |
| webkit | medium | baseline | 0–1 | 30 | 10.0 / 15.0 / 26.0 / 0 | 42.0 / 94.0 / 112.0 / 0 | 98.0 / 227.0 / 278.0 / 6 | 114.0 / 245.0 / 330.0 / 11 | 106.0 / 234.0 / 286.0 / 6 | 61.0 / 145.0 / 302.0 / 1 |
| webkit | medium | baseline | 2–9 | 30 | 13.0 / 90.0 / 92.0 / 0 | 38.0 / 182.0 / 207.0 / 5 | 146.0 / 500.0 / 1104.0 / 14 | 169.0 / 558.0 / 1130.0 / 20 | n/a (30 not seen) | 101.0 / 225.0 / 326.0 / 7 |
| webkit | medium | nomidi | 0–1 | 30 | 11.0 / 18.0 / 19.0 / 0 | 7.0 / 8.0 / 8.0 / 0 | 91.0 / 225.0 / 229.0 / 5 | 108.0 / 232.0 / 245.0 / 7 | 97.0 / 235.0 / 238.0 / 6 | n/a |
| webkit | small | baseline | 2–9 | 30 | 1.0 / 4.0 / 4.0 / 0 | 2.0 / 6.0 / 71.0 / 0 | 14.0 / 55.0 / 75.0 / 0 | 27.0 / 79.0 / 150.0 / 0 | 35.0 / 99.0 / 159.0 / 1 | 4.0 / 10.0 / 77.0 / 0 |

| Browser | Edits while playing | Playback stopped by the edit | Max abs(tick restored − tick stored) | t0 → midiLoaded |
|---|---|---|---|---|
| chromium | 10 | 10/10 | 1 | 52.3 / 92.4 / 92.4 / 0 |
| webkit | 10 | 10/10 | 1 | 77.0 / 181.0 / 181.0 / 1 |

## 5. Evaluation against < 150 ms

Endpoint "t0 → next frame" (the earliest frame that can show the edit; scheduler delay excluded):

| Document | Chromium median / p95 | WebKit median / p95 | Median < 150 | p95 < 150 |
|---|---|---|---|---|
| small 8 × 4 | 15.9 / 21.5 | 27.0 / 79.0 | yes / yes | yes / yes |
| medium 50 × 8 (bars 2–9 · bars 0–1) | 83.7 / 147.4 · 97.9 / 185.3 | 169.0 / 558.0 · 114.0 / 245.0 | Chromium yes · yes; WebKit no · yes | Chromium yes (147.4, borderline) · no (185.3); WebKit no · no |
| large 300 × 8, best variant (window-nomidi) | 244.1 / 352.0 | 255.0 / 339.0 | no / no | no / no |
| large 300 × 8, baseline (bars 0–1) | 534.5 / 725.7 | 619.0 / 1312.0 | no / no | no / no |

"Edited bar drawn", where observable, lies within −15 … +26 ms of "next frame" (medians, both
browsers; the partial image can arrive before the frame callback), so both endpoints give the same
verdicts, except horizontal layout, where the edited bar is drawn 0.5–1 s later.

**Verdict:** the target is met for the small document in both browsers. It is not met for
300 × 8 in any measured variant, and not reliably for 50 × 8 (Chromium p95 147–185 ms over two runs;
WebKit p95 245–558 ms).

## 6. Bottlenecks

1. **Whole-document work on every edit.** Conversion of all bars and both Scores (medians): ≈ 7–13 ms
   (50 × 8) and ≈ 65–104 ms (300 × 8) in the browsers, 29 / 173 ms in Node. Every variant converts the whole
   document, including the render window.
2. **MIDI regeneration on the main thread**, twice (alphaTab's Render-Score MIDI, then the S7 hook's
   Playback-Score MIDI): Node ≈ 201 + 206 ms for 300 × 8; in the browser the `renderScore` call takes
   235–368 ms (Chromium medians) and drops to 37–41 ms without MIDI (nomidi). The hook doubles this cost.
3. **Worker layout and rendering of the whole sheet**: without MIDI, `renderFinished` still takes
   ≈ 490 ms (Chromium) / 564 ms (WebKit) for 300 × 8; it runs in parallel with the MIDI work, so
   removing MIDI alone barely moves `renderFinished` (532 → 493 ms).
4. **Score transfer to the worker:** with a 16-bar window and no MIDI, `renderFinished` is still
   233–251 ms (median); alphaTab serialises and lays out the full Score even when only a window is
   displayed (not isolated further).
5. Horizontal layout is the slowest variant (a single 300-bar row); edited-track-only saves ≈ 60 ms
   median in Chromium. The edit itself (< 0.1 ms) and the hit-test walk (≤ 4 ms) are negligible.

## 7. Player position preservation

Medium document, 10 edits while playing per browser: every edit **stopped playback** (10/10, as S7
found); storing `tickPosition` before the edit and setting it after `midiLoaded` restored the position
within **1 tick** (max). `midiLoaded` after t0: Chromium 52 / 92 ms, WebKit 77 / 181 ms (median /
p95). Auto-resume was not tested (off by default, §6).

## 8. Fallback assessment

| Fallback | Source | 300 × 8 result (t0 → next frame, median) | Trade-off |
|---|---|---|---|
| Horizontal layout | §6 (1) | worse: 767 ms (Chromium), 930 ms (WebKit) | — |
| Render window, 16 bars | §6 (2) | 385–478 ms (Chromium), 363–410 ms (WebKit) | context outside the window hidden |
| Edited track only | §6 (3) | 465 ms (Chromium), 546 ms (WebKit) | other tracks hidden while editing |
| Decoupled MIDI (renderer only) | measured candidate | 499 ms (Chromium), 573 ms (WebKit) | player and `api.score` keep the previous Score until MIDI is regenerated (e.g. on play); cursor/beat events refer to the old Score |
| Window + decoupled MIDI | measured candidate | 244 ms (Chromium), 255 ms (WebKit) | both of the above |

**No measured fallback reaches < 150 ms on 300 × 8; none is selected.** The measurements point to
work that is proportional to the whole document on every edit (conversion, Score transfer, layout).
Options that would avoid it are **not measured** and need an architecture decision: converting only
the displayed bars into the Render Score (a partial Score for the window), moving conversion off the
main thread, or regenerating MIDI only when playback starts.

## 9. Limitations

- Synthetic benchmark documents and a modelled edit command; real editing patterns are not covered.
- Headless Playwright Chromium and WebKit on one Intel Mac; not Safari, not Firefox, no throttled
  or mobile CPU.
- RenderScheduler delay, input-event latency and the caret overlay are not measured (§2).
- 30 measured edits per scenario and one session per scenario; no scenario was repeated in a second
  session. The bars 0–1 runs are different scenarios from the bars 2–9 runs, not repeats, although
  they show the same orders of magnitude.
- The harness HTML was reformatted by Prettier after the measurements (whitespace only); the smoke
  test was run again afterwards.

Validation (2026‑11‑24, agent): `pnpm format:check` clean; `pnpm depcruise` no violations (152
modules); `pnpm turbo run lint typecheck test build --force` 24/24 tasks (S2 spike 677 passed, 4
skipped, 4 of them S3 unit tests); S2 `pnpm test:browser` 10 passed (S7 and the S3 smoke test in
Chromium and WebKit), 26 skipped (the S3 measurement runs, gated by `S3_MEASURE=1`); S6 smoke 4/4;
S1 end-to-end 2/2.

## 10. Open decisions

1. A1–A5 (§1.1): start and end points, statistic, document size and visible tracks of the target.
2. Whether to pursue an unmeasured option of §8 for large scores (partial Render Score, off-main-thread
   conversion, MIDI only on play), each needing its own measurement and an ADR.
3. Whether the S7 hook's second MIDI generation is acceptable in the edit loop (§6.2).
