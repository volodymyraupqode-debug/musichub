# MusicHub — Project Specification

> Status: **Draft v0.2 (audited 2026‑11‑21) — awaiting approval.**
> Product name: **MusicHub** (approved 2026‑11‑21, Q1 resolved). The earlier working name "Guitar Studio" is retired.
> Documentation language: English. The root `*.md` files are the source of truth. If two of them disagree, fix the docs before writing code.
>
> **Changelog v0.2.11:** Q22 added (MinIO images discontinued).
>
> **Changelog v0.2.10:** Q20 resolved (courses/LMS post‑v1; personal practice stays; data model ready for future courses). Q21 resolved (microphone guitar analysis → post‑v1 Audio/AI phase; MIDI guitar via spike S8, not committed). Non-goals and F12 updated.
>
> **Changelog v0.2.9:** Q16 resolved: practice results stored server-side and synced; F12 extended; Q20 (lessons) and Q21 (guitar correctness) added; R20 added.
>
> **Changelog v0.2.8:** Q14 resolved (access matrix in API.md §1.1, anti-spam rules in §10.1); Q19 added.
>
> **Changelog v0.2.7:** Q9 resolved: alphaTab attribution kept; rules and MPL‑2.0 obligations detailed in §7.
>
> **Changelog v0.2.6:** Q12 resolved, Node.js 26 LTS pinned; R18 updated.
>
> **Changelog v0.2.5:**
> - Q11 refined per owner guidance: mobile is native-first Expo (RN + shared TS + native modules), with a WebView only for justified components (notation).
> - A mobile audio/MIDI prototype is the gate before full mobile development.
> - Added Q18; R8 and R12 updated.
>
> **Changelog v0.2.4:** Q3/Q4 resolved: MusicXML export and MIDI file import are post‑v1. MIDI **devices** (keyboard input, practice, visualizer) stay in v1 (§2.3).
>
> **Changelog v0.2.3:** Q2b resolved; all tooling in §5.2 approved.
>
> **Changelog v0.2.2:** Q2 resolved (approved libraries §5.1; Zustand, React Hook Form and shadcn/ui added; Three.js postponed); Q11 resolved (Expo); remaining tooling listed as Q2b (§5.2).
>
> **Changelog v0.2.1:** Q1 resolved, product name MusicHub; naming rules added (§1.1).
>
> **Changelog v0.2:** added a requirement coverage matrix (§2.2); added Practice mode (wait mode, performance check) to scope, which was post‑v1 in v0.1 and is now required; added hand assignment; replaced the risk table with a full risk register (probability/impact/priority); listed every proposed library with its license (§5.1); extended open questions; server-side import moved to the mobile phase (see ARCHITECTURE.md §2).

## 1. Product summary

**MusicHub** is a platform for creating, editing, playing, learning and sharing music. It includes a music editor, a Guitar Tab Editor, a Piano Visualizer and a Community. It is cross-platform (web first, then iOS and Android). It is inspired by the *workflow* of Guitar Pro: tablature-centric multi-track scores with playback. It is **not** a clone. No Guitar Pro names, assets, icons, colors or UI layout are copied. It reads and writes Guitar Pro files only for interoperability.

| Persona | Needs |
|---|---|
| Guitarist / bassist learning songs | Open GP/MusicXML files, play back, loop, slow down, follow cursor |
| Pianist / keyboard learner | Falling-notes Piano Visualizer, 88-key keyboard, MIDI keyboard, practice mode with feedback |
| Arranger / songwriter | Multi-track editor (tab + standard notation + piano roll), export |
| Community member | Publish compositions, profiles, likes, comments, follows |

### 1.1 Naming rules

- **Product name:** "MusicHub", always written exactly so (capital M and H, one word). Use it in the README, web and mobile UI, page titles, navigation, metadata (`<title>`, Open Graph, app store listings, `app.json` display name), documentation and project materials (GitHub repository name, issue templates).
- "Guitar Studio" is no longer used as the product name anywhere.
- **Technical identifiers** keep their lowercase form and are not renamed for branding: the npm scope `@musichub/*`, the root package `musichub`, the database `musichub`, the bucket `musichub-local`, the file extension `.mhd.json`, the document format value `format: 'musichub'`, the class prefix `Mhd*`.
- Feature names used in UI copy: "Guitar Tab Editor", "Piano Visualizer", "Piano Roll", "Practice", "Community", "Library". "Guitar Pro" appears only in factual file-format statements (§7).

## 2. Functional scope

| # | Feature | Summary | Primary doc |
|---|---|---|---|
| F1 | Guitar tablature editor | Fret/string entry, techniques (bends, slides, hammer-on/pull-off, palm mute, harmonics…), tunings, capo | MUSIC_ENGINE.md §7 |
| F2 | Standard music notation | Always rendered; pitch/rhythm/voice editing on notation staves | MUSIC_ENGINE.md §7 |
| F3 | Multi-track compositions | Tracks with instruments, staves (incl. piano grand staff), mixer | MUSIC_ENGINE.md §3 |
| F4 | Playback engine | SoundFont synthesis, cursor, loop, speed, metronome, count-in | MUSIC_ENGINE.md §5 |
| F5 | Piano Visualizer | Falling notes + 88-key keyboard synced to the audio clock, hand colors | PIANO_VISUALIZER.md |
| F6 | Piano Roll | Grid-based note editing projected onto the canonical model | MUSIC_ENGINE.md §8 |
| F7 | MIDI I/O | **v1:** MIDI keyboard connection, real-time MIDI events, live key highlight, practice & correctness check, step entry, recording; MIDI file export. **Post‑v1:** MIDI file import (Q4). MIDI device output in Phase 5 | MUSIC_ENGINE.md §9 |
| F8 | User music library | Own compositions, folders, tags, search, imports | API.md §4, DATABASE.md |
| F9 | Community | Public compositions, profiles, likes, comments, follows, reporting, blocking | API.md §7–8 |
| F10 | iOS & Android apps | Library, viewer/player, visualizer, practice, community | MOBILE.md |
| F11 | Cloud sync | Revisioned documents, optimistic concurrency, local drafts, autosave | ARCHITECTURE.md §6 |
| F12 | Practice mode (personal practice) | Wait mode, hand selection, loop, speed, correctness check with a MIDI keyboard; **progress synced across devices** (completed fragments, goals, stats, accuracy, rhythm, BPM, attempts, time, history, resume position). Guitar: listen/play-along with time/BPM/attempt stats; correctness only via MIDI input if spike S8 passes. No courses/lessons (Q20) and no microphone analysis (Q21) | PIANO_VISUALIZER.md §6, API.md §7a |

### 2.1 File interoperability (verified against alphaTab 1.9.0, MUSIC_ENGINE.md §2)

| Format | Import | Export |
|---|---|---|
| Guitar Pro 3–5 (`.gp3 .gp4 .gp5`) | ✅ | ❌ |
| Guitar Pro 6 (`.gpx`) | ✅ | ❌ |
| Guitar Pro 7/8 (`.gp`) | ✅ | ✅ (`Gp7Exporter`; opens in GP7/GP8 only, not in GP5/6) |
| MusicXML (`.xml .musicxml .mxl`) | ✅ | ❌ not in v1 (Q3 resolved: post‑v1; alphaTab has no exporter) |
| Capella (`.capx`) | ✅ | ❌ |
| alphaTex (text) | ✅ | ✅ |
| MIDI file (`.mid`) | ❌ not in v1 (Q4 resolved: post‑v1; alphaTab has no importer) | ✅ (SMF via alphaTab MIDI generator) |
| Audio (WAV) | — | ✅ (alphaTab `exportAudio` gives 32‑bit float PCM; we encode WAV) |
| MusicHub document (`.mhd.json`) | ✅ | ✅ (native, MUSIC_ENGINE.md §3) |

### 2.1a MIDI scope in v1 (Q4 clarification)

Only the import of ready-made MIDI **files** is deferred. Work with MIDI **devices** stays in v1:

| In v1 | Phase |
|---|---|
| Connecting a MIDI keyboard (Web MIDI: Chrome, Edge, Firefox) | P2 |
| Receiving MIDI events in real time (note on/off, velocity, sustain) | P2 |
| MIDI for practice mode and correctness checking | P2 |
| Pressed keys shown in the Piano Visualizer | P2 |
| MIDI step entry and recording into the editor | P3 / P5 |
| MIDI file export | P1 |

| Post‑v1 | |
|---|---|
| MIDI file import (Q4) | Phase 9 |
| MusicXML export (Q3) | Phase 9 |

### 2.2 Requirement coverage matrix

| Requirement | Covered by | Phase | Status |
|---|---|---|---|
| Create compositions | editor-core commands, templates in music-model | P3 | ✅ designed |
| Edit notes & tablature | MUSIC_ENGINE §7 | P3 | ✅ designed; editor built by us (alphaTab has no editing) |
| Guitar & keyboard parts | MHD stringed staves + grand staff (§3.2) | P1/P3 | ✅ |
| Multi-track, different instruments | MHD tracks + GM programs (SoundFont) | P1 | ✅ |
| Notation & tablature | alphaTab rendering | P1 | ✅ verified |
| Import/export | MUSIC_ENGINE §4 | P1/P2 | ✅ within §2.1 limits |
| Playback, BPM change, metronome | alphaTab player + tempo commands | P1/P3 | ✅ verified |
| Undo/Redo | editor-core inverse commands | P3 | ✅ designed |
| Autosave | IndexedDB drafts + server autosave (ARCHITECTURE §6) | P3/P4 | ✅ designed |
| Sync between devices | revisions + `If-Match` | P4 | ✅ designed |
| 88 keys, falling notes, duration-length bars, key highlight, polyphony | PIANO_VISUALIZER §3 | P2 | ✅ designed |
| Sound synchronized with animation | audio-anchored clock (PIANO_VISUALIZER §5) | P2 | ⚠️ needs spike S6 |
| Left/right hand colors | `Staff.hand` / `Note.hand` in MHD | P2 | ✅ added v0.2 |
| Piano Roll | MUSIC_ENGINE §8 | P5 | ✅ designed (quantised) |
| Speed change, loop | alphaTab `playbackSpeed`, `playbackRange` + `isLooping` | P1 | ✅ verified |
| Practice mode, correctness check | practice-core (PIANO_VISUALIZER §6) | P2 | ✅ designed; one-hand audio needs a playback-only score split (MUSIC_ENGINE §5.2) |
| Practice results synced across devices (private, opt-out, export/delete, offline) | DATABASE §3.15–3.17, API §7a, ARCHITECTURE §6a | P2 local / P4 sync | ✅ designed (Q16) |
| Guitar practice correctness | MIDI guitar: spike S8 (not committed); microphone: post‑v1 Audio/AI | P2 (S8) / post‑v1 | ⚠️ deferred by decision (Q21) |
| Courses & lessons | — | post‑v1 | ⏸ deferred by decision (Q20) |
| MIDI keyboard | midi-engine, Web MIDI | P2 | ⚠️ not in Safari / iOS WebView |
| Registration, profiles, library, search, follows, likes, comments, publishing, uploads | API.md, DATABASE.md | P4/P6 | ✅ |
| iOS & Android | MOBILE.md (Expo native-first, Q11 resolved) | P8 | ✅ designed; audio/visualizer placement decided by the mobile prototype (ROADMAP Phase 2M, after Phase 2) |

## 3. Non-goals (v1.0)

- AI features: after initial release.
- Learning management: course catalog, course/module/lesson hierarchy, curriculum builder, teacher accounts, certificates, LMS features (Q20, post‑v1; separate design).
- Microphone-based analysis: pitch, note and chord recognition, rhythm detection, error detection and comparison with the original part for acoustic or electric guitar (Q21, post‑v1 Audio/AI phase).
- Real-time collaborative editing (CRDT/OT). v1 uses revisioned documents with conflict detection.
- Audio recording / DAW features (audio tracks, effects plugins).
- Microservices. One Laravel API + one Next.js app + queue workers (ARCHITECTURE.md §2).
- Engraving-grade manual layout control.
- Monetisation/payments.
- Unquantised (free-timing) performance data in the document (MUSIC_ENGINE.md §8).

## 4. Platforms

| Platform | Priority | Notes |
|---|---|---|
| Web desktop: Chrome, Edge, Firefox, Safari (latest 2 versions) | P0 | Primary target. Web MIDI is **not available in Safari**, so MIDI features are hidden there with an explanation. |
| Web mobile browsers | P2 | Viewer/player/visualizer only, responsive. |
| iOS / Android | P3 | After web v1.0 (ROADMAP Phase 8). See MOBILE.md. |

## 5. Technology (fixed by requirements)

| Area | Choice | Pinned version at start |
|---|---|---|
| Runtime / tooling | Node.js, pnpm | **Node.js 26 LTS** (Active LTS since 2026‑10‑28; `.nvmrc` = 26.13.1, `engines` `>=26.13.0 <27`; CI uses the same major via `.nvmrc`). No Current/odd releases. pnpm 12.21.0 pinned via `packageManager` (`engines` `>=12.21.0 <13`) |
| Web | Next.js (App Router), React, TypeScript (strict) | Next.js 16.4 (Turbopack default), React 19, TypeScript 6.0.x (typescript-eslint supports < 6.1) |
| API | Laravel (separate Composer project) | Laravel 13, PHP ≥ 8.3 (use 8.4) |
| Database | PostgreSQL | 18.x (19.0 was released 2026‑11‑19; adopt after its first minor) |
| Cache / queues | Redis | 7.4+/8.x (Redis 8 is tri-licensed incl. AGPLv3; unmodified server use is fine; Valkey is a drop-in BSD alternative, Q13) |
| Notation & playback | alphaTab (`@coderline/alphatab`) | **1.9.0 exactly** (MPL‑2.0) |
| Mobile | React Native / Expo | Expo SDK 58 (RN 0.88, New Architecture mandatory) |
| Containers | Docker / Docker Compose | — |
| Monorepo | pnpm workspaces + Turborepo (JS/TS only) | Turborepo 2.11 |

### 5.1 Approved libraries & platform APIs (Q2, approved 2026‑11‑21)

| Library / API | Purpose | License | Where |
|---|---|---|---|
| alphaTab 1.9.0 | Notation, tablature, playback, file IO | MPL‑2.0 | `music-engine` only |
| Zustand | Editor/studio state. The framework-agnostic store uses `zustand/vanilla`; React binds via `zustand` hooks | MIT | `editor-core` (vanilla store), `apps/web`, `apps/mobile` |
| TanStack Query | Server state, API caching | MIT | `apps/web`, `apps/mobile` |
| Zod | Data validation: MHD schema, API payloads, forms; JSON Schema export | MIT | `music-model`, apps |
| Vitest | Unit tests | MIT | all TS packages |
| Playwright | E2E tests | Apache‑2.0 | `apps/web` |
| React Hook Form (+ `@hookform/resolvers` for Zod) | Forms (auth, settings, metadata, comments) | MIT | `apps/web` |
| shadcn/ui (requires Tailwind CSS v4; Radix primitives) | Web UI components, generated into `packages/ui` as owned source | MIT | `packages/ui` |
| React Native / Expo | Mobile app (resolves Q11) | MIT | `apps/mobile` |
| Web Audio API | Audio beyond alphaTab: monitoring sampler fallback, calibration clicks, latency estimation (`outputLatency`) | platform API | `music-engine`, `midi-engine` |
| Web MIDI API | MIDI devices in the browser | platform API | `midi-engine` only |
| Canvas 2D | Falling notes, keyboard, piano roll | platform API | `piano-visualizer`, studio piano roll |
| ESLint 10 + typescript-eslint 8, Prettier 3 | Lint/format | MIT | in use since T0.1 |

**Not approved for now:** Three.js (3D visualisation). Revisit only if a 3D view is requested. WebGL in general needs an ADR (PIANO_VISUALIZER §3).

### 5.2 Approved tooling & services (Q2b, approved 2026‑11‑21)

Items from the v0.2 proposal that the Q2 decision did not cover. All are approved. The "Needed from" column shows when each is introduced (do not add earlier):

| Library / service | Purpose | License | Needed from |
|---|---|---|---|
| Pest, Larastan, Laravel Pint | PHP tests, static analysis, format | MIT | Sprint 1 (S1-04, S1-06) |
| Laravel Sanctum, Horizon | Auth; queue dashboard | MIT | Phase 4 |
| openapi-typescript + openapi-fetch | Generated API client | MIT | Sprint 1 (S1-12) |
| opis/json-schema (PHP) | Validate the MHD envelope against the generated JSON Schema | Apache‑2.0 | Phase 4 |
| dependency-cruiser | Package boundary enforcement | MIT | Sprint 1 (S1-03) |
| next-intl | i18n | MIT | Phase 1 |
| Storybook | Component workbench | MIT | Phase 1 |
| Lucide icons (shadcn/ui default); Inter, JetBrains Mono fonts | Icons, fonts | ISC; OFL | Phase 1 |
| S3-compatible storage (MinIO locally) | Document blobs, uploads | MinIO AGPLv3 (dev only); managed S3 in prod | Sprint 1 (S1-07). ⚠️ MinIO images are no longer published; local replacement pending Q22 |
| Sentry | Error reporting | SDKs MIT | Phase 4 |

## 6. Quality attributes

| Attribute | Target |
|---|---|
| Score open (≤ 300 bars, ≤ 8 tracks) | first render < 2 s on a mid-range laptop |
| Edit → re-render latency | < 150 ms perceived for a single-note edit on the active track (spike S3, risk R2) |
| Visualizer | 60 fps; audio/visual offset < 20 ms after calibration |
| MIDI input → key highlight | < 30 ms |
| Document safety | No data loss on tab close: local draft autosave ≤ 2 s |
| Accessibility | WCAG 2.2 AA for application chrome; notation canvas is keyboard-operable |
| i18n | UI strings externalised from day one; EN first, UK second |

## 7. Legal & licensing constraints

- **alphaTab is MPL‑2.0** (file-level copyleft). It is compatible with a closed-source commercial product if alphaTab files are used unmodified (or modified files are published) and the license notice ships with the app (third-party notices page). Rule: no patching of alphaTab internals (AGENT_RULES.md §4).
- **alphaTab attribution: kept (Q9 resolved 2026‑11‑21).** alphaTab draws a small "♪ alphaTab.net" mark above the first system on scores with more than 10 bars or more than 2 rendered tracks, and there is no setting to turn it off. MusicHub treats it as a binding usage condition: the README states that removing or hiding it requires maintainer permission. (The alphaTab docs note that MPL‑2.0 itself has no UI-credit clause; we comply with the maintainers' terms regardless.) Rules:
  - The default mark stays exactly as alphaTab renders it, in every theme, layout and platform (web, `ScoreView` on mobile, public pages).
  - Never remove, hide, crop, cover, recolor to invisibility, scale away or clip it: no CSS, no overlays, no container sizing that cuts it off, no post-processing of the SVG/canvas.
  - Later, if it conflicts with the design, the owner may ask the alphaTab maintainer for an alternative placement. The proposal is a permanent credit `Notation & playback: alphaTab` in the editor panel or next to the score.
  - The default rendering may change only after **explicit written permission**. That permission is stored in `docs/legal/alphatab-attribution.md` and referenced by an ADR.
- **MPL‑2.0 obligations for alphaTab:**
  - Ship alphaTab's license text and copyright notice in the third-party notices (web `/legal/notices` page, mobile "About → Licenses", and in the distributed bundles where license comments are kept).
  - Use alphaTab files unmodified. If an MPL-covered file is ever modified (fork), its source must be made available under MPL‑2.0, the modification documented, and an ADR written (AGENT_RULES §4).
  - Our own code that only calls alphaTab is not affected (MPL is file-level copyleft).
  - Do not remove the license headers that alphaTab includes.
- **Future license change:** alphaTab 1.9.0 release notes announce a possible move to CPAL‑1.0, which would make attribution a license condition and adds network-use terms. Pin 1.9.0; legal review before any upgrade.
- Bravura font (SIL OFL), SONiVOX SoundFont (Apache‑2.0): ship notices.
- Community content: transcriptions of copyrighted songs. Terms of Service, takedown process, reporting and blocking are required before the Community launches.
- "Guitar Pro" is a third-party trademark. Use it only in factual file-format compatibility statements.

## 8. Risk register

Probability (P) and Impact (I): Low / Medium / High. Priority: **P1** (address before or during Phase 0–1), **P2** (address before the phase that needs it), **P3** (monitor).

| ID | Risk | P | I | Priority | Mitigation | Owner doc |
|---|---|---|---|---|---|---|
| R1 | Editor complexity: alphaTab has no editing; the whole editor (input, caret, selection, commands, layout overlay) is our code | High | High | P1 | Own model + command layer; incremental scope (tab first, then notation); spike S2/S3; strict scope per phase | MUSIC_ENGINE §7 |
| R2 | Full re-render per edit (no incremental layout) may be slow on large scores; a new `Score` also reloads MIDI and stops playback | High | High | P1 | Render visible tracks only; coalesce; edit-mode layout window; restore tick after reload; measure in S3 | MUSIC_ENGINE §6 |
| R3 | Guitar Pro compatibility: lossy GP → MHD → GP7 round-trip; GP7 export not openable in GP5/6 | Medium | High | P1 | Coverage matrix, golden round-trip tests, keep the original upload, import warnings | MUSIC_ENGINE §4 |
| R4 | Next.js 16 Turbopack integration (no webpack plugin; worklet loads ~2.5 MB unminified core via `core.scriptFile`) | Medium | Medium | P1 | Documented Turbopack setup; spike S1; `--webpack` fallback; CDN caching | ARCHITECTURE §4 |
| R5 | A/V sync: no exposed audio clock in alphaTab; only `playerPositionChanged` (frequency undocumented) | Medium | High | P1 | Audio-anchored interpolated clock, latency compensation, calibration; spike S6 | PIANO_VISUALIZER §5 |
| R6 | Timeline parity: our repeat/tie expansion vs alphaTab MIDI generation | Medium | High | P1 | Golden parity tests vs `MidiFileGenerator` (S5); interim `activeBeatsChanged` highlighting | MUSIC_ENGINE §3.5 |
| R7 | Visualizer/playback performance on dense scores and mobile WebViews | Medium | Medium | P2 | Canvas culling, static layers, 30 fps mode; WebGL only via ADR | PIANO_VISUALIZER §8 |
| R8 | MIDI support: no Web MIDI in Safari; Web MIDI unusable in React Native; alphaTab cannot output to MIDI devices (its device API is audio-only) | High | Medium | P2 | Web: feature detection, `midi-engine`. Mobile: native MIDI module (CoreMIDI / android.media.midi), prototype M1. MIDI out: own scheduler | MUSIC_ENGINE §9, MOBILE §3 |
| R9 | Piano roll (free timing) vs notation (rhythmic values) | High | Medium | P2 | Notation-first model + quantised projection | MUSIC_ENGINE §8 |
| R10 | Practice one-hand playback: alphaTab mutes per Track only, but a grand staff is one Track | Certain | Medium | P2 | Playback-only score with staves split into separate tracks/channels (MUSIC_ENGINE §5.2); spike S7 | MUSIC_ENGINE §5.2 |
| R11 | Sustain pedal: stored in alphaTab model (`Bar.sustainPedals`) but apparently not played back by the MIDI generator | Medium | Medium | P2 | Spike S7; fallback: playback-only lengthening of pedalled notes in the playback score | MUSIC_ENGINE §5.2 |
| R12 | Code reuse Web ↔ Mobile: no alphaTab on iOS/RN, so notation needs a WebView component; mobile audio latency and A/V sync are unproven | Medium | High | P2 | Expo native-first (Q11): shared TS logic runs in RN; WebView only for notation; native MIDI/audio modules; mobile prototype M1–M7 in Phase 2M (right after Phase 2) | MOBILE.md §6 |
| R13 | Licenses: alphaTab future CPAL, attribution request, SoundFont/fonts redistribution, Redis 8 / MinIO AGPL | Medium | High | P1 | Pin versions, license gate for dependencies (AGENT_RULES §8), notices page, managed S3 in prod | §7 |
| R14 | Copyright claims and spam/abuse in community content | High | High | P2 (before P6) | ToS, reports with auto-hide threshold, blocks, takedown workflow, moderation tools; verified email for comments/publishing/uploads; new-account limits and rate limits (API.md §1.1, §10.1) | API.md §8 |
| R15 | Sync conflicts between devices / tabs | Medium | Medium | P2 | Revisions + `409` + "save as copy"; single editing tab via Web Locks | ARCHITECTURE §6 |
| R16 | Revision storage growth from autosave snapshots | Medium | Medium | P2 | Autosave interval ≥ 30 s idle, tiered thinning, dedupe by hash | ARCHITECTURE §6 |
| R17 | Browser autoplay policies (AudioContext needs a user gesture), esp. Safari/iOS | High | Low | P2 | Start audio on the first explicit play; "tap to enable audio" state | MUSIC_ENGINE §5 |
| R18 | Toolchain churn: TypeScript 7 not yet supported by typescript-eslint; Node 26 patch updates | Low | Low | P3 | Update Node patch versions and TS major via dedicated tasks; Node 26 LTS is supported until 2029‑04 | §5 |
| R19 | Sanctum SPA cookies need web and API on the same registrable domain | Medium | Medium | P2 | Deploy `app.<domain>` + `api.<domain>` or proxy `/api` through the web host | ARCHITECTURE §7 |
| R20 | Privacy of practice data (behavioural data per user) and sync edge cases (duplicates, clock skew between devices) | Medium | Medium | P2 | Owner-only endpoints, no community joins, opt-out, export/delete; client UUIDv7 idempotency; server receive time stored; last-write-wins with tombstones for goals | ARCHITECTURE §6a |

## 9. Open questions (need owner decision)

| # | Question | Options / recommendation |
|---|---|---|
| Q1 | ~~Product name~~ | ✅ **Resolved 2026‑11‑21: MusicHub** (naming rules §1.1) |
| Q2 | ~~Approve proposed libraries~~ | ✅ **Resolved 2026‑11‑21** (§5.1). Three.js not approved for now |
| Q2b | ~~Approve the remaining tooling~~ | ✅ **Resolved 2026‑11‑21** (§5.2, all approved) |
| Q3 | ~~MusicXML export in v1.0?~~ | ✅ **Resolved 2026‑11‑21: post‑v1** (notation-compatibility complexity) |
| Q4 | ~~MIDI file import in v1.0?~~ | ✅ **Resolved 2026‑11‑21: post‑v1** (stabilise MHD first). MIDI devices are **not** deferred (§2.3) |
| Q5 | Default visibility of new compositions; are forks/remixes of public compositions allowed? | Recommend private by default; forks off for v1 |
| Q6 | License options for public user content | (a) All rights reserved only; (b) + CC BY / CC BY‑SA |
| Q7 | Hosting target | (a) single VPS + Docker Compose; (b) managed cloud (DB, Redis, S3) |
| Q8 | Auth providers beyond email/password | Google / Apple (Apple is mandatory on iOS if any social login exists) |
| Q9 | ~~alphaTab attribution~~ | ✅ **Resolved 2026‑11‑21: keep the default mark.** Any alternative placement only with explicit written permission from the maintainer (§7) |
| Q10 | UI languages at launch | EN + UK assumed |
| Q11 | ~~Mobile technology~~ | ✅ **Resolved 2026‑11‑21: Expo + React Native, native-first.** Shared TS logic; native modules for MIDI and audio; WebView only for justified components (notation); custom native audio/MIDI if the prototype requires; no automatic WebView port of the web editor (MOBILE.md §2) |
| Q12 | ~~Node version~~ | ✅ **Resolved 2026‑11‑21: Node.js 26 LTS.** Compatibility checked via package `engines`: Next.js 16.4 (≥ 20.9), Expo SDK 58 (^26), React Native 0.88 (≥ 26), ESLint 10 (≥ 24), Vitest (≥ 26), Playwright (≥ 20), typescript-eslint 8, TypeScript 6, Prettier, Turborepo, pnpm 12, alphaTab 1.9.0 |
| Q13 | Redis vs Valkey | Redis per requirements; Valkey if license policy demands |
| Q14 | ~~Email verification for Community~~ | ✅ **Resolved 2026‑11‑21:** browsing and profiles are open; likes, follows, reports and blocks need sign-in; comments, publishing, posts and file uploads need a verified email. Verification is one of several protections (API.md §1.1, §10.1) |
| Q15 | What does a user's account deletion do to their public compositions? | (a) delete; (b) anonymise and keep |
| Q16 | ~~Store practice results server-side?~~ | ✅ **Resolved 2026‑11‑21: yes.** Aggregated sessions, progress, goals and the resume position sync across devices. Private, sync can be turned off, export/delete available, offline-first; no raw audio or MIDI streams (DATABASE.md §3.15–3.17, API.md §7a, ARCHITECTURE.md §6a) |
| Q17 | Community "publications": only public compositions, or also text posts / activity feed? | Recommend compositions only for v1. If posts are added, they require a verified email (Q14) |
| Q19 | CAPTCHA / bot protection at registration (e.g. a privacy-friendly provider) beyond honeypot + rate limits? | (a) not in v1, revisit if spam appears (recommended); (b) add a provider (needs library/service approval) |
| Q20 | ~~Lessons/courses system~~ | ✅ **Resolved 2026‑11‑21: post‑v1.** v1 keeps personal practice only: completed fragments, goals, stats, accuracy, BPM, attempts, time, history, resume. No course catalog, course/module/lesson hierarchy, curriculum builder, teachers, certificates or LMS. The learning system gets its own design after v1; the practice data model is ready for it (DATABASE.md §3.15 `source`/`source_ref`) |
| Q21 | ~~Guitar correctness checking~~ | ✅ **Resolved 2026‑11‑21:** microphone pitch detection and analysis of acoustic/electric guitar playing move to the post‑v1 **Audio/AI phase**. v1 keeps guitar notation/tab display and playback. MIDI-guitar checking is researched in spike S8 and is **not** a v1 commitment without a passing prototype and an owner decision |
| Q22 | Local S3-compatible storage: MinIO no longer publishes container images (Docker Hub repo removed, quay.io requires auth). Replacement for dev/CI? | (a) SeaweedFS (Apache‑2.0, single container with S3 gateway); (b) RustFS (Apache‑2.0, MinIO-compatible, younger project); (c) build MinIO from source into our own image (AGPLv3, maintenance burden). Production stays managed S3 |
| Q18 | Mobile libraries chosen by the Phase 2M prototype (e.g. a native 2D drawing library for the visualizer, a native audio/SoundFont engine, an Expo audio package) | Decide after prototype M1–M7; each needs approval like Q2 |

## 10. Document map

| File | Content |
|---|---|
| PROJECT_SPEC.md | Scope, coverage, constraints, risks, open questions |
| ARCHITECTURE.md | Monorepo, runtime architecture, sync, deployment |
| DATABASE.md | PostgreSQL schema |
| API.md | REST contracts (`/api/v1`) |
| MUSIC_ENGINE.md | alphaTab audit, canonical document model, engine, editor, MIDI |
| PIANO_VISUALIZER.md | Falling notes, keyboard, sync, practice mode |
| DESIGN_SYSTEM.md | Tokens, components, theming |
| MOBILE.md | Mobile strategy |
| ROADMAP.md | Phases, exit criteria, Sprint 1 plan |
| AGENT_RULES.md | Detailed rules for AI agents |
| AGENTS.md | Short entry point for AI agents |
