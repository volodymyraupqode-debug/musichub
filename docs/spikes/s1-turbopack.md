# Spike S1 — alphaTab 1.9.0 in Next.js 16 with Turbopack

- **Task:** ROADMAP.md S2-04 (MUSIC_ENGINE.md §10, spike S1)
- **Code:** `spikes/s1-turbopack` (kept until the end of Sprint 2; S2/S3/S7 reuse it)
- **Status:** automated checks done in Chromium and Playwright WebKit; **Safari passed the manual check (owner, audible sound confirmed)**; **Firefox is not verified yet** (§8)
- **Date:** 2026-11-23

## 1. Goal

Confirm that the documented Turbopack integration of alphaTab 1.9.0 (ARCHITECTURE.md §4, ADR-0004) works in Next.js 16 without the webpack plugin: rendering, render worker, audio-worklet playback, production build and theming through `display.resources`, in Chrome, Firefox and Safari.

## 2. Versions

| Component | Version |
|---|---|
| Next.js | 16.4.6 (Turbopack, default build) |
| React / React DOM | 19.3.1 |
| alphaTab | `@coderline/alphatab` 1.9.0 (pnpm catalog) |
| Node.js | 26.13.1 |
| Playwright | 1.65.1 (Chromium rev. 1255, WebKit rev. 2388 / WebKit 27.2) |

## 3. Integration

- `src/app/page.tsx` (server component) renders `ScoreSpike`, a client component (`'use client'`).
- `ScoreSpike` creates `new AlphaTabApi(element, settings)` in `useEffect` and calls `api.destroy()` on unmount. No alphaTab code runs on the server.
- The score is an original alphaTex fragment (`src/score.ts`, 2 tracks × 12 bars), loaded with `api.tex(score, 'all')`. **`tex()` renders only the first track unless the track list (`'all'`) is passed.**
- No webpack plugin, no `--webpack` flag, `next.config.ts` has no alphaTab-specific settings.
- `src/probes.ts` instruments the page (spike only): it wraps `Worker`, `AudioWorklet.prototype.addModule` and `AudioContext` to record what actually starts, and exposes the alphaTab events as `window.__s1`.

### Asset copy

`scripts/copy-alphatab.mjs` runs as `predev` and `prebuild` and copies from the installed package `dist/` into `public/alphatab/` (git-ignored: `spikes/*/public/alphatab/`):

- `font/` (Bravura), `soundfont/` (SONiVOX), `alphaTab.mjs`, `alphaTab.core.mjs`.

### Settings

| Setting | Value |
|---|---|
| `core.scriptFile` | `/alphatab/alphaTab.mjs` |
| `core.fontDirectory` | `/alphatab/font/` |
| `core.useWorkers` | `true` |
| `player.enablePlayer` | `true` |
| `player.playerMode` | `EnabledSynthesizer` |
| `player.outputMode` | `WebAudioAudioWorklets` |
| `player.soundFont` | `/alphatab/soundfont/sonivox.sf2` |
| `display.resources` | per theme (§6); switched with `settings.fillFromJson(...)`, `updateSettings()`, `render()` |

## 4. Workers and audio worklet

| Check | Result | Evidence |
|---|---|---|
| Workers start under Turbopack | ✅ 2 workers in Chromium and WebKit (prod) | `Worker` probe: `/_next/static/chunks/turbopack-worker-*.js#params=…` (Turbopack-bundled workers, created from a blob bootstrap in the chunk) |
| Workers in dev | ✅ 4 workers | React Strict Mode mounts the component twice in dev; the first instance is destroyed (its AudioContext ends `closed`) |
| Audio worklet loads | ✅ `addModule('/alphatab/alphaTab.mjs')` resolves (`ok: true`) on every Play | `addModule` probe; the URL is `core.scriptFile` |
| Worklet errors | none | probe and console |

The renderer class name is minified in production (`n3`), so worker rendering is proven by the worker probe, not by the class name.

## 5. Dev and production

| Check | Production (`next build` + `next start`) | Dev (`next dev`, Turbopack) |
|---|---|---|
| Build | ✅ ≈ 11 s cold, Turbopack, no warnings | — |
| Page opens | ✅ | ✅ |
| Both tracks rendered (2 × 12 bars) | ✅ `renderedTracks: 2` | ✅ |
| Assets load (font, SoundFont) | ✅ | ✅ |
| Theme light ↔ dark | ✅ | ✅ |
| Play / Pause / Play / Stop | ✅ | ✅ (Play/Pause) |
| Console errors | none | none (only React DevTools info, HMR log) |

## 6. Themes

Switching the theme changes the colours alphaTab writes into its SVG (`display.resources`), not CSS around the score:

| Theme | Page background | Colours found in the alphaTab SVG | Contrast vs background |
|---|---|---|---|
| Light | `#ffffff` | `#1F2328` (glyphs, text), `#57606A` (secondary, bar lines), `#8C959F` (staff lines) | 15.8 : 1, 6.4 : 1, 3.0 : 1 |
| Dark | `#0d1117` | `#E6EDF3`, `#9198A1`, `#6E7681` | 16.0 : 1, 6.5 : 1, 4.1 : 1 |

The attribution mark **♪ alphaTab.net** is drawn above the first system in both themes and is not clipped (checked on screenshots). It is drawn as SVG paths, not text, so a DOM text search does not find it; automated tests cannot assert it without image comparison.

## 7. Audio

Checked in the embedded Chromium (production and dev) through the probes:

| Step | Result |
|---|---|
| `playerReady`, `soundFontLoaded` before Play | ✅ |
| Play → state `playing` | ✅ 8–19 ms after the click |
| Audio worklet module loaded | ✅ `ok: true` |
| Playback position advances | ✅ e.g. 0 → 2784 ms after 3 s; 268 position events |
| Pause → position frozen | ✅ unchanged over 1.5 s |
| Play again → continues | ✅ +1941 ms in 2 s from the pause position |
| Stop | ✅ state `paused` |
| SoundFont / worklet errors | none |
| **Audible sound** | not checkable in this environment; **confirmed by hand in Safari** (§8.1) |
| **Autoplay policy** | **not verified**: the embedded Chromium allows audio without a gesture (both AudioContexts are `running` at load), so the gesture requirement must be checked in Safari/Chrome by hand |

Observations:
- alphaTab creates its AudioContext(s) at initialisation, not on the first Play (two `running` contexts at load in Chromium).
- After Pause the reported position snapped to a beat boundary (2500 ms = 4 beats at 96 bpm) although playback had passed 2784 ms. Clock behaviour is the subject of spike S6.
- `outputLatency` reads `0` in the embedded Chromium.

## 8. Browser matrix

| Browser | Dev | Production | Rendering | Audio | Worker | Notes |
|---|---|---|---|---|---|---|
| Chromium (embedded, Chrome 156) | ✅ | ✅ | ✅ 2 tracks, themes | ✅ playback cycle by probes; sound: manual | ✅ 2 (4 in dev, Strict Mode) | Autoplay not testable here |
| Chromium (Playwright rev. 1255, headless) | — | ✅ smoke | ✅ 2 tracks, themes | not tested | ✅ 2 | `e2e/score.spec.ts` |
| WebKit (Playwright rev. 2388, headless) | — | ✅ smoke | ✅ 2 tracks, themes | not tested | ✅ 2 | **Not Safari**: Playwright's WebKit build |
| Safari (manual, owner) | not recorded | not recorded | ✅ 2 tracks, themes | ✅ sound audible, Play/Pause/Resume | ✅ workers and AudioWorklet | PASS (§8.1); Safari and OS versions not recorded |
| Firefox | not tested | not tested | — | — | — | Desktop Firefox not installed; the cached Playwright Firefox build (rev. 1538) does not match Playwright 1.65.1 (rev. 1572), nothing installed. Manual check pending (§8.2) |

### 8.1 Manual Safari verification — PASS

The owner ran the steps below in Safari and confirmed that everything works (2026-11-23). Recorded as reported by the owner:

| Check | Result |
|---|---|
| Page opens | ✅ PASS |
| Both tracks render | ✅ PASS |
| Player ready | ✅ PASS |
| Workers and AudioWorklet work | ✅ PASS |
| Play produces audible sound | ✅ PASS |
| Playback position advances | ✅ PASS |
| Pause stops playback | ✅ PASS |
| Play again resumes playback | ✅ PASS |
| Theme switch works | ✅ PASS |

Safari version, macOS version, dev/production mode and timing values: **not recorded**. The autoplay behaviour (sound only after a gesture) was not reported separately.

Steps used:


1. `pnpm --filter @musichub/spike-s1-turbopack build`, then `pnpm --filter @musichub/spike-s1-turbopack start` (port 3200).
2. Open `http://localhost:3200` in Safari. Open Develop → Show Web Inspector → Console.
3. Without clicking: both tracks (Guitar, Piano) are visible; ♪ alphaTab.net is visible top right; the probe panel shows `"renderedTracks": 2`, `"playerReady": true`, `"workers"` with 2 entries, `"errors": []`.
4. Click **Play / Pause**: sound is audible; `"playerState": "playing"`, `"positionMs"` increases, `"worklets"` has `"ok": true`, `"audioContextStates"` ends with `running`.
5. Click **Play / Pause** again: sound stops, `positionMs` stays constant. Click once more: playback continues from the same place.
6. Click **Theme** twice: dark then light, notation colours change, attribution stays visible.
7. Report: Safari version, whether sound was audible, any console errors, and the values of `firstRenderMs`, `soundFontLoadedMs`, `playerReadyMs`, `firstPositionMs`.

Also repeat steps 2–4 with `pnpm --filter @musichub/spike-s1-turbopack dev` (port 3200 as well, through `predev`).

### 8.2 Manual Firefox check — pending

Firefox is not installed on the test Mac, and the cached Playwright Firefox build does not match Playwright 1.65.1, so neither a manual nor an automated Firefox run was possible. Nothing was installed. Steps for the owner, on any machine with desktop Firefox:

1. `pnpm --filter @musichub/spike-s1-turbopack build`, then `pnpm --filter @musichub/spike-s1-turbopack start` (port 3200).
2. Open `http://localhost:3200` in Firefox and the Web Console (Tools → Browser Tools → Web Developer Tools → Console).
3. Before clicking: both tracks and ♪ alphaTab.net are visible; the probe panel shows `"renderedTracks": 2`, `"soundFontLoaded": true`, `"playerReady": true`, `"workers"` with 2 entries, `"errors": []`.
4. Click **Play / Pause**: sound is audible, `"playerState": "playing"`, `"positionMs"` increases, `"worklets"` has an entry with `"ok": true`.
5. Click **Play / Pause**: sound stops and `positionMs` stays constant; click again: playback continues from the same place.
6. Click **Theme** twice: notation colours change dark → light; the attribution stays visible.
7. Return: Firefox version, OS, whether sound was audible, PASS/FAIL per step, console errors (if any), and the probe values `workers`, `worklets`, `audioContextStates`, `firstRenderMs`, `soundFontLoadedMs`, `playerReadyMs`, `firstPositionMs`.

## 9. Measurements

Conditions: macOS 26.7.3, Intel Core i7-9750H, local server on `localhost`, embedded Chromium (Chrome 156) of the Claude desktop app. Times are milliseconds from the component mount (`performance.now()` in `useEffect`), recorded by the probes.

| Metric | Production, cold (n = 1, first load after server start, earlier score version with overfull bars) | Production, warm cache (n = 6) | Dev (n = 1) |
|---|---|---|---|
| First SVG render finished (`renderFinished`) | 1262 | median 246.5 (202–391) | 443 |
| SoundFont loaded (`soundFontLoaded`) | 1165 | median 195.5 (152–306) | 384 |
| Player ready (`playerReady`) | 1213 | median 204.5 (160–316) | 394 |

| Metric (Play click → …) | Production (n = 4) | Dev (n = 1) |
|---|---|---|
| State `playing` | median 14 (8–19) | — |
| First playback position > 0 (synth consumed audio) | median 212.5 (148–234) | 234 |
| First audible sound | not measured (needs audio loopback, spike S6) | — |

These numbers mix network-free local loading with a fast machine; they are indicative only and must not be read as production latency.

### Asset sizes

| Asset | Size |
|---|---|
| `public/alphatab/alphaTab.core.mjs` | 2,606,053 B (533,385 B gzip) |
| `public/alphatab/alphaTab.mjs` | 6,238 B |
| `soundfont/sonivox.sf2` (used) | 1,351,896 B |
| `soundfont/sonivox.sf3` (copied, unused) | 977,208 B |
| `font/Bravura.woff2` (used) | 313,348 B |
| `public/alphatab/` total (all copied files) | 8,657,475 B |
| Largest JS chunk (`3qtpu2m4l5h8q.js`, contains alphaTab) | 1,261,900 B (308,525 B transferred, compressed by `next start`) |
| All `.next/static` JS | 1,844,557 B |

### Two copies of alphaTab

alphaTab is shipped twice: (1) bundled by Turbopack into the page chunk and the Turbopack workers (1.26 MB minified), and (2) as `public/alphatab/alphaTab.core.mjs` (2.6 MB unminified), which the audio worklet loads through `core.scriptFile` because Turbopack does not bundle audio worklets. The alphaTab docs list this as a known limitation of the Turbopack setup. Consequences:

- The first playback downloads the unminified core once more (≈ 533 KB gzip, 2.6 MB raw). It should be served with long-lived immutable cache headers (ARCHITECTURE.md §4).
- Both copies must come from the same package version; the copy script copies from the installed package at every `dev`/`build`, so they cannot drift.
- The copy script also copies unused files (`sonivox.sf3`, `.eot`, `.otf`, `.svg`, licence texts). Copying only the used files would cut `public/alphatab/` by several megabytes; licence texts must stay available for the notices page.

## 10. Known issues and limitations

- alphaTex durations carry over to the next beats; the first version of the spike score had overfull bars until the bars reset the duration (fixed in the score, found by checking every bar with alphaTab's model).
- `tex()` without a track list renders only the first track.
- Attribution can only be checked visually (SVG paths).
- In dev, React Strict Mode creates and destroys a first alphaTab instance; the destroy path works (AudioContext `closed`), production creates one instance.
- Autoplay policy and `outputLatency` are unverified; audible output is confirmed only by the manual Safari check.
- Firefox untested (not installed, no matching Playwright build); Playwright WebKit is not Safari, but Safari itself passed by hand.
- The spike ESLint preset has no React/Hooks rules (acceptable for throw-away code).

## 11. Conclusion

In Chromium (embedded and Playwright) and in Playwright WebKit, the documented Turbopack setup works in development and production without the webpack plugin: Turbopack bundles and starts the alphaTab workers, the audio worklet loads from `core.scriptFile`, playback runs, pauses and resumes, and theming through `display.resources` re-renders the score. **Turbopack is confirmed for Chromium and, by the owner's manual check, for Safari (including audible playback). Firefox is not yet confirmed.**

## 12. Recommendation for ADR-0004 (decision by the owner)

**Accept with documented limitations.** Chromium and Safari pass; the decision can be taken now with Firefox recorded as an open verification item, or after the manual Firefox check (§8.2):

- Turbopack, no webpack plugin; copy `font/`, `soundfont/`, `alphaTab.mjs`, `alphaTab.core.mjs` in `predev`/`prebuild`; set `core.scriptFile`, `core.fontDirectory`, `player.soundFont`.
- Limitations to record: two copies of alphaTab (worklet core loaded on first Play), cache headers for `/alphatab/*`, `tex()`/`renderTracks` must pass the track list, attribution checked visually.
- Open item: Firefox (desktop) not verified. If it fails to play or start workers, record the evidence and evaluate the `--webpack` fallback as a separate proposal (not switched in this spike).
- ADR-0004 text to update with the decision: the path `apps/web/public/alphatab/` (production), the confirmed worker behaviour under Turbopack, and the measured core size (2,606,053 B).

The ADR status is not changed by this spike.
