# MusicHub — Mobile (iOS & Android)

> Status: Draft v0.3 — awaiting approval. Starts **after web v1.0** (ROADMAP Phase 8). **Technology approved: Expo + React Native (Q11, 2026‑11‑21)**. Expo SDK 58 / React Native 0.88 (New Architecture mandatory since SDK 55), TypeScript, in `apps/mobile`.
>
> **Changelog v0.3** (owner guidance on Q11):
> - Architecture is native-first. React Native screens + shared TypeScript logic + native modules; **WebView only for individual web components where justified**.
> - The full web editor is **not** ported into a WebView.
> - A mandatory **mobile audio/MIDI prototype** on real iOS and Android devices is the gate before full mobile development (§6). It runs in **ROADMAP Phase 2M, right after Phase 2** (owner decision 2026‑11‑21), with a short re-check at the start of Phase 8.
> - The v0.2 "everything in one WebView engine" plan is replaced. It survives only as one candidate in §4.2.

## 1. Scope (mobile v1)

| Feature | Mobile v1 | Later |
|---|---|---|
| Sign in / profile | ✅ | Apple / Google sign-in (Q8) |
| Library (own compositions, folders, offline cache) | ✅ | |
| Score/tab viewer with playback (cursor, loop, speed, mixer) | ✅ | |
| Piano Visualizer | ✅ | |
| MIDI keyboard (USB / Bluetooth MIDI) | ✅ if the prototype passes (§6) | |
| Practice mode (listen / play-along / wait, correctness check) | ✅ (MIDI-based modes need MIDI) | |
| Community: browse, like, comment, follow, report, block | ✅ | |
| Import from the Files app / share sheet | ✅ (server import, API.md §6) | |
| Editing | ❌ | Separate decision; the web editor is not reused via WebView |
| Push notifications | ❌ | follows, comments |

## 2. Principles

1. **Expo + React Native is the application.** Navigation, screens, lists, forms, transport controls and practice UI are React Native.
2. **Shared TypeScript logic runs natively in the RN JS runtime:**
   - `music-model`: types, schema, timeline, `NoteEvent`, templates;
   - `practice-core`;
   - the geometry part of `piano-visualizer`;
   - `api-client`;
   - `design-tokens`.

   No duplication in Swift/Kotlin.
3. **Native modules** (Expo Modules API, `apps/mobile/modules/*`) for device access: MIDI, audio session, low-latency audio when needed.
4. **WebView only for individual web components, and only where justified.** A WebView is justified when no native alternative exists. The concrete case is **notation/tab engraving**: alphaTab has no iOS or React Native build (MUSIC_ENGINE.md §2.6), and re-implementing engraving is out of scope. Every other WebView use needs a written justification (ADR).
5. **No automatic port of the web editor.** The studio, editor UI and piano roll are not embedded in mobile. Mobile editing is a later, separate product decision.
6. **Custom native audio/MIDI solutions** are built only if the prototype (§6) shows they are needed.

## 3. Component allocation

| Concern | Implementation | Why |
|---|---|---|
| App shell, navigation, library, community, settings | React Native (Expo Router) | Native UX |
| Server state / app state | TanStack Query / Zustand | Same as web |
| Document model, timeline, hands, tempo map | `music-model` in RN JS | Shared logic |
| Practice evaluation, wait mode | `practice-core` in RN JS | Shared logic |
| MIDI device input | **Native module** `modules/midi`: CoreMIDI (iOS), `android.media.midi` (Android); implements the `LiveNoteSource` contract | Web MIDI does not exist in RN or iOS WKWebView |
| Audio session (silent switch, interruptions, routing) | **Native module** or an Expo audio package; chosen by the prototype | iOS ringer switch and interruptions must be handled natively |
| Score / tab rendering | **WebView component** `ScoreView`: a small bundle with `music-engine` (render only) | No native engraving engine exists for iOS |
| Playback audio | **Decided by the prototype** (§4.2) | Latency and A/V sync must be measured on devices |
| Piano Visualizer drawing | **Decided by the prototype** (§4.3) | Depends on where the audio clock lives |
| Transport controls, practice toolbar | React Native | Native feel |

## 4. Open design points (resolved by the prototype)

### 4.1 Shared contracts

The shared contracts are the same as on web (MUSIC_ENGINE.md §3.6): `PlaybackClock`, `LiveNoteSource`, plus the `transport` interface (PIANO_VISUALIZER.md §8). Each mobile option below implements these contracts, so `practice-core` stays unchanged.

### 4.2 Playback audio options

| Option | Description | Pros | Cons |
|---|---|---|---|
| A1. alphaTab synth inside the `ScoreView` WebView | WebView renders and plays; the clock is bridged to RN (anchors + interpolation) | Same sound and timing as web; no extra audio code | WebView audio latency, background audio, silent switch; the bridge adds clock jitter |
| A2. Native audio module | Native sampler/SoundFont playback (e.g. AVAudioEngine on iOS, Oboe/AAudio on Android) driven by `NoteEvent`s from `music-model`; WebView only renders | Lowest latency, background audio, precise clock | Significant native work; timbre parity with web must be managed |
| A3. Hybrid | Score playback via A1; low-latency monitoring of MIDI input via a native module | Less native work than A2 | Two audio paths |

### 4.3 Visualizer drawing options

| Option | Description | Needs |
|---|---|---|
| V1. Inside a WebView | Reuse the web Canvas painter in a WebView component next to the clock (fits A1) | WebView justification (ADR) |
| V2. Native drawing | Reuse the `piano-visualizer` geometry/culling (pure TS) with a native painter (fits A2) | A native 2D drawing library; not yet approved (Q18) |

### 4.4 `ScoreView` WebView component

- Bundle `apps/mobile/score-view/` (Vite build) contains only `music-engine` render/playback parts and alphaTab assets. It ships inside the app, works offline and includes no editor and no studio UI.
- Typed bridge protocol (schema in `music-engine/bridge`):

```ts
type ToScoreView =
  | { type: 'load'; document: MhdDocument; tracks: string[] }
  | { type: 'setTheme'; theme: 'light' | 'dark' } | { type: 'setLayout'; mode: 'page' | 'horizontal' }
  | { type: 'highlight'; tick: number }                 // cursor follows external clock (option A2)
  | { type: 'play' } | { type: 'pause' } | { type: 'seek'; tick: number }   // only with option A1
  | { type: 'setLoop'; range: { startTick: number; endTick: number } | null }
  | { type: 'setSpeed'; ratio: number } | { type: 'setTrackMix'; trackId: string; mix: object };
type FromScoreView =
  | { type: 'ready'; protocolVersion: number }
  | { type: 'clockAnchor'; scoreMs: number; tick: number; perfNow: number; speed: number } // A1 only
  | { type: 'beatTapped'; tick: number } | { type: 'state'; state: string }
  | { type: 'error'; code: string; message: string };
```

- Large documents (> 2 MB) are written to app storage and loaded by file URL.

## 5. Data & sync

- The same REST API (`/api/v1`) with Sanctum bearer tokens (`POST /auth/tokens`), stored in `expo-secure-store`.
- Generated `api-client` + TanStack Query; app state in Zustand. Offline cache: `expo-sqlite` for metadata, files for documents.
- Practice progress, goals and the resume position sync with web (ARCHITECTURE.md §6a). Sessions recorded offline sit in a SQLite outbox and upload on reconnect.
- Mobile v1 is read-mostly for documents: no document writes except metadata. Sync conflicts cannot come from mobile in v1.
- Imports use server-side import (`POST /uploads` + `POST /imports`, `apps/music-worker`, Phase 8).

## 6. Mobile audio/MIDI prototype (ROADMAP Phase 2M, after Phase 2; gate before full mobile development)

Run on **real devices**: at least one recent and one older iPhone, and one mid-range and one low-end Android, with USB and Bluetooth MIDI keyboards. Prototype code lives in `spikes/mobile-*`: a throw-away Expo app, not the production `apps/mobile`. Phase 8.0 re-runs M1–M3 and M5 on the then-current versions.

| # | Question | Pass criteria |
|---|---|---|
| M1 | MIDI input via a native module: CoreMIDI and `android.media.midi`, USB + BLE, hot-plug, timestamps | Events reach JS with device timestamps; key → highlight < 30 ms |
| M2 | alphaTab playback in a WebView (A1): AudioWorklet in WKWebView / Android WebView, start latency, silent switch, interruptions (calls), background | Stable playback 10 min; documented limits |
| M3 | Clock over the bridge (A1): jitter of `clockAnchor` in RN | Interpolated error < 15 ms |
| M4 | Native audio (A2) minimal: play `NoteEvent`s from a SoundFont / sampler | Latency, CPU, sound quality vs web |
| M5 | Monitoring latency: MIDI key → sound | < 30 ms (iOS), < 50 ms (Android) target |
| M6 | Visualizer fps: V1 (WebView canvas) vs V2 (native painter) on low-end Android | ≥ 30 fps, ideally 60 |
| M7 | `ScoreView` loading: workers/worklet from local files (`file://`, custom scheme or local server), memory for large scores | Loads offline; memory within budget |

**Output:** ADR‑0005 update with the chosen A-option and V-option, the native modules list, the libraries to approve (Q18) and the go/no-go for each mobile v1 feature (e.g. MIDI over BLE).

## 7. UI

- Shares `design-tokens` (TS output). Components are RN-specific (shadcn/ui is web-only) and mirror the web names and variants.
- Navigation: Expo Router. Tabs: Explore · Library · Practice · Profile.
- Landscape support for the viewer, visualizer and practice.

## 8. Release

- EAS Build + EAS Submit; internal distribution first (TestFlight / Play internal testing).
- App Store rules: Sign in with Apple is required if any third-party sign-in is offered. User-generated content requires reporting and blocking (API.md §7–8).
- OTA updates (EAS Update) for JS and the `score-view` bundle; the runtime version is tied to the native modules and the bridge `protocolVersion`.
