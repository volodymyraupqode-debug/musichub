# MusicHub — Music Engine

> Status: Draft v0.2 (audited 2026‑11‑21) — awaiting approval. Pinned dependency: **`@coderline/alphatab` 1.9.0** (MPL‑2.0).
> Packages: `music-model` (document, timeline, shared contracts), `editor-core` (commands), `music-engine` (alphaTab adapter: IO, render, playback, clock), `midi-engine` (MIDI devices), `practice-core` (practice logic). See ARCHITECTURE.md §3.
>
> **Changelog v0.2:**
> - The audit now records: `renderScore` with a new Score reloads MIDI and stops playback; mute/solo/volume work per Track only; sustain pedal markers exist in the model but appear not to be played; the Selection API names; `playNote`/`playBeat` are one-shot previews; there is no exposed AudioContext and no injectable synth output; the attribution rules.
> - Added §2.7 (what we build ourselves, with alternatives).
> - MHD: added hand assignment, sustain pedal, first-bar invariants, templates. Renamed `tieOrigin` → `tiedFromPrevious` for clarity (same meaning).
> - Added §5.2 (playback-score variants) and spike S7.
> - MIDI devices moved to `midi-engine`.
>
> **Changelog v0.2.9:** Phase 0 declared complete by the owner (2026‑11‑25, ROADMAP.md §Phase 0) under the Q0 rule; §10 Q0 note and results header updated. No pass criterion or spike status changes; Phase 1 is not approved.
>
> **Changelog v0.2.8:** S7 owner disposition (2026‑11‑25, ADR-0002 Amendment 8, A18; Option B1): S7 stays not met; Phase 1 owns sustain-pedal playback (audible check, §5.2 pedal variant if needed), Phase 2 owns the hand-split playback score and its audible verification (§5.2, §10). Every unmet §10 spike now has a recorded disposition.
>
> **Changelog v0.2.7:** S4 owner disposition (2026‑11‑25, ADR-0002 Amendment 7, A17; Option 2): the S4 criterion is unchanged and not met; Phase 1 owns the production importer, `COVERAGE.md`, golden round-trip tests on legally usable MusicXML fixtures, the three recorded import deviations, the tenuto/slur/transposing-key MHD questions and the GP7 stringed-staff finding; Phase 7 owns independent GP3–GP8 evidence before v1.0 (§4.2, §10).
>
> **Changelog v0.2.6:** S3 owner disposition (2026‑11‑25, ADR-0002 Amendment 6, A16; Option B + D): the S3 gap is placed in Phase 3 (Editor) with the real `editor-core` and RenderScheduler measured under the unchanged A9; Phase 1's `toAlphaTab`, render-controller and Playback Score design must keep a partial Render Score, off-main-thread conversion and MIDI regeneration on play feasible (§6). §10 S3 row and Q0 note updated. S3 remains not met.
>
> **Changelog v0.2.5:** S5 owner decisions (2026‑11‑25, ADR-0002 Amendment 5, A10–A15): §3.2 gets *Repeats and navigation* ([CONV] rules 1–3 adopted; D1 kept with an implicit Playback Score `repeatStart`, not yet verified), the half-open hi-hat key rule (timeline reports the MHD GM key) and the open default dynamic; §3.3 gets invariants 14 (skipped closing bar rejected, D2) and 15 (at most one segno and one coda); §10 S5 row updated. No `schemaVersion` change (§3.4). The S5 pass criterion is not met by these decisions.
>
> **Changelog v0.2.4:** Decisions Q-D and Q-E after the S2-05 review. `Bar.ottava` is a display-only octave line over the current bar (not carried forward, not a clef ottava; pitch stays sounding). `MasterBar.fermata: true` is replaced by positioned `fermatas: { position; type?: 'short'|'long' }[]`; fermata positions join invariant 11; new warnings `fermata-not-on-beat` and `ottava-not-displayed`. Fermata playback length belongs to the timeline. No `schemaVersion` bump (pre-release rule, §3.4).
>
> **Changelog v0.2.3:** D1: the percussion articulation vocabulary (`drumArticulation`, 9 ids) is replaced by the orthogonal `drumTechnique` (`halfOpen`, `rimshot`, `edge`, `choke`) next to the GM `pitch`. MHD v1 is unreleased, so `schemaVersion` stays 1 (§3.4).
>
> **Changelog v0.2.2:** MHD v1 decisions after the S2-02 review: UUIDv7 document id, `true`-only optional flags, brush duration as `Duration`, `drumArticulation` vocabulary, `synth` as a keyboard family, repeat/ending limit 99, `rest ⇔ no notes`, every schema change bumps `schemaVersion`, invariants 3/7/8 defined precisely (§3.2–3.4, §4.2).
>
> **Changelog v0.2.1:** Q21. Microphone pitch/performance analysis is post‑v1 (Audio/AI phase, §11a). The MIDI guitar is researched in spike S8, not committed for v1. Guitar notation, tab and playback are unchanged.

## 1. Role of alphaTab

alphaTab is used for: **parsing** foreign formats, **engraving** (standard notation, tab, slash, numbered), **synthesis/playback**, **exporting** GP7/alphaTex/MIDI/audio, and **hit-testing** (mouse events + bounds lookup).

alphaTab is **not** used as: the storage format, the editing model, the source of IDs, or a UI. Its docs state it is an SDK, not a ready-made component, and warn that direct modification of the data model "is usually not easily possible" and may break rendering. Hence ADR‑0002: own canonical model (MHD) + adapter.

## 2. Capability audit (alphaTab 1.9.0)

Legend: ✅ verified in docs/source · ⚠️ partially verified / behaviour to confirm in spike · ❌ not supported / not found.

Sources: alphatab.net docs (v1.9.0), GitHub `CoderLine/alphaTab` `develop` branch (`packages/alphatab/src/{importer,exporter,model,midi,synth}`), release notes 1.4–1.9. Research date 2026‑11‑21.

### 2.1 Import

| Capability | Status | Evidence |
|---|---|---|
| Guitar Pro 3–5 | ✅ | `Gp3To5Importer.ts`; 1.9 default encoding windows‑1252 (`importer.gp3To5encoding`) |
| Guitar Pro 6 `.gpx` | ✅ | `GpxImporter.ts`, `GpxFileSystem.ts` |
| Guitar Pro 7/8 `.gp` | ✅ | `Gp7To8Importer.ts`, `GpifParser.ts`; GP8 backing tracks since 1.6 |
| MusicXML `.xml/.musicxml/.mxl` | ✅ | `MusicXmlImporter.ts`; parser reimplemented in 1.5 (partwise + timewise) |
| Capella | ✅ | `CapellaImporter.ts` (docs disagree `.cap` vs `.capx` → test both) |
| alphaTex | ✅ | `AlphaTexImporter.ts`, `api.tex(...)` |
| MIDI file import | ❌ | No MIDI importer in `importer/` |
| Entry point | ✅ | `ScoreLoader` (importer/ScoreLoader.ts) |

### 2.2 Export

| Capability | Status | Evidence |
|---|---|---|
| Guitar Pro 7+ `.gp` | ✅ | `exporter/Gp7Exporter.ts`; 1.9: output opens in GP7 and GP8 |
| alphaTex | ✅ | `exporter/AlphaTexExporter.ts` (since 1.7) |
| MIDI (SMF type 0/1) | ✅ | `midi/MidiFileGenerator.ts`, `MidiFile.toBinary(): Uint8Array`, `MidiFileFormat`; `api.downloadMidi()` |
| Audio | ✅ | `api.exportAudio(options): Promise<IAudioExporter>` (since 1.6); `render(ms)` chunks with `samples: Float32Array`, stereo, 32‑bit float; options incl. `sampleRate`, `masterVolume`, `metronomeVolume`, `playbackRange`, `trackVolume`, `trackTranspositionPitches`, `soundFonts`, `useSyncPoints`. WAV encoding is ours. |
| MusicXML export | ❌ | No exporter in `exporter/` |
| GP3–5 / GPX export | ❌ | — |
| JSON (`JsonConverter.scoreToJson / jsonToScore / scoreToJsObject / jsObjectToScore`) | ⚠️ | Exists, generated serializer, **no stability/versioning guarantee** → never persisted |

### 2.3 Rendering

| Capability | Status | Notes |
|---|---|---|
| Staves: standard, tab (guitar/bass), drum tab (1.9), slash, numbered/jianpu | ✅ | `display.staveProfile`; per-staff `Staff.showStandardNotation`, `showTablature`, `showSlash`, `showNumbered` |
| Multiple staves per track (piano grand staff) | ✅ | `Track.staves: Staff[]` |
| `renderScore(score, trackIndexes?, renderHints?)` | ✅ | Renders an in-memory `Score` for selected tracks. With a **new** Score object and the player enabled it calls `loadMidiForScore()`, which **stops playback** (AlphaTabApiBase.ts). With the same Score it only re-renders. Position preservation is not documented. |
| `render()`, `renderTracks(...)` | ✅ (signatures ⚠️) | |
| Layout modes `Page`, `Horizontal`, `Parchment` | ✅ | `display.layoutMode` |
| `display.scale`, `barsPerRow`, `startBar`, `barCount`, `barCountPerPartial`, `core.enableLazyLoading` | ✅ | Partial rendering = chunked output, **not** incremental re-layout of edited bars |
| Incremental re-render of one edited bar | ❌ | Not documented → assume full re-layout per `renderScore` (risk R2) |
| Rendering in Web Worker | ✅ (`core.useWorkers`), ✅ under Turbopack | Confirmed by spike S1: Turbopack starts the alphaTab workers (ADR‑0004, docs/spikes/s1-turbopack.md) |
| Colors/fonts (`display.resources`, per-element styling since 1.5) | ✅ | Used for theming (DESIGN_SYSTEM.md §5) |
| Attribution mark "♪ alphaTab.net" | ✅ | Drawn above the first system when the song has > 10 bars or > 2 rendered tracks; no setting to hide it. **Kept unchanged (Q9).** Layout and containers must never clip it (PROJECT_SPEC §7). |

### 2.4 Interaction / lookup

| Capability | Status | Notes |
|---|---|---|
| `beatMouseDown/Move/Up`, `noteMouseDown/Move/Up` | ✅ | Primary hit-testing for editor |
| `boundsLookup`: staffSystems → bars → beats → notes with `visualBounds`/`realBounds`, notes `noteHeadBounds` (needs `core.includeNoteBounds`) | ✅ | Caret/selection overlay |
| `getBeatAtPos`-style API | ⚠️ | Not found in 1.9 docs → use events or our own search over `boundsLookup` |
| Selection API (1.8): `highlightPlaybackRange(startBeat, endBeat)`, `applyPlaybackRangeFromHighlight()`, `clearPlaybackRangeHighlight()`, event `playbackRangeHighlightChanged` (beats, bounds, highlight blocks) | ✅ | Range highlight for **loop selection**. It is not an editor selection/caret; editor selection is our overlay. |
| `tickCache: MidiTickLookup` (`findBeat`, `getBeatStart`, `getMasterBarStart`) | ✅ | Tick ↔ beat mapping |
| Cursor (`player.enableCursor`, `enableAnimatedBeatCursor`, `customCursorHandler`, scroll settings) | ✅ | |

### 2.5 Playback

| Capability | Status | Notes |
|---|---|---|
| Synth with SoundFont2 | ✅ | `player.soundFont` URL; bundled SONiVOX sf2 (Apache‑2.0) |
| SoundFont3 | ⚠️ | Marked experimental in 1.4; Vorbis decoder present |
| `player.playerMode`: `Disabled`, `EnabledAutomatic`, `EnabledSynthesizer`, `EnabledBackingTrack`, `EnabledExternalMedia` | ✅ | We use `EnabledSynthesizer` |
| `player.outputMode`: `WebAudioAudioWorklets` (default, falls back), `WebAudioScriptProcessor` | ✅ | |
| `play/pause/stop/playPause` | ✅ | |
| `playNote(note)`, `playBeat(beat)` | ✅ | One-shot preview through a one-off MIDI file; does not change the main playback position. Audible once `isReadyForPlayback`. Used for note audition while editing. |
| `tickPosition`, `timePosition`, `endTick`, `endTime` | ✅ | |
| `playerPositionChanged → { currentTick, currentTime, endTick, endTime, isSeek, modifiedTempo, originalTempo }` | ✅ | Event frequency not documented → clock interpolation (PIANO_VISUALIZER §5) |
| `activeBeatsChanged → { activeBeats: Beat[] }` (all tracks/voices) | ✅ | |
| `playedBeatChanged`, `playerStateChanged`, `playerFinished`, `playerReady`, `soundFontLoaded`, `midiLoaded` | ✅ | |
| `midiEventsPlayedFilter` + `midiEventsPlayed` | ✅ | e.g. metronome events |
| `playbackRange`, `isLooping`, range highlight APIs | ✅ | A‑B loop |
| `playbackSpeed`, `masterVolume`, `metronomeVolume`, `countInVolume` | ✅ | |
| `changeTrackMute(tracks: Track[], mute)`, `changeTrackSolo(tracks, solo)`, `changeTrackVolume(tracks, volume)`, `changeTrackTranspositionPitch(tracks, semitones)` | ✅ | **Per Track (MIDI channel) only.** There is no per-Staff mute, so one hand of a grand staff cannot be muted directly (§5.2). |
| Sustain pedal | ⚠️ | Model has `Bar.sustainPedals: SustainPedalMarker[]` (`Down`, `Hold`, `Up`). No CC64 generation was found in `MidiFileGenerator.ts`, so it is probably **not played back**. Spike S7. |
| Access to AudioContext / audio output timestamp | ❌ | Not exposed. Timing comes only from `playerPositionChanged`, `timePosition`, `tickPosition`. |
| Inject a custom `ISynthOutput` | ❌ | The interface is public, but no web API/setting to supply one was found (only `EnabledExternalMedia` uses an internal output). |
| `enumerateOutputDevices/setOutputDevice` | ✅ | **Audio** output devices (experimental sink API), **not MIDI** |
| Send playback to external MIDI device | ❌ | Not provided → own scheduler (§9) |
| MIDI input from devices | ❌ | Not provided → Web MIDI API (§9) |

### 2.6 Platforms

| Platform | Status |
|---|---|
| Browser (ES2020) / Node headless: `ScoreLoader.loadScoreFromBytes` + `ScoreRenderer` (SVG; PNG via alphaSkia) | ✅ (exporters in Node ⚠️, verify in Phase 8) |
| .NET (NuGet `AlphaTab`, `AlphaTab.Windows`) | ✅ (not used) |
| Android Kotlin (`net.alphatab:alphaTab`, API 26+, `AlphaTabView`) | ✅ (possible future native path) |
| iOS native | ❌ |
| React Native / Expo | ❌ → `ScoreView` WebView component for notation only; audio per the mobile prototype (MOBILE.md §3–4) |

### 2.7 What alphaTab does not provide — we build it (or use an alternative)

| Need | alphaTab | Our solution / alternative |
|---|---|---|
| Editing model, commands, undo/redo, caret, input | ❌ | `music-model` + `editor-core` (§3, §7) |
| Persistent, versioned document format | ❌ (`JsonConverter` unversioned) | MHD (§3) |
| Autosave, sync | ❌ | ARCHITECTURE.md §6 |
| Piano Visualizer, Piano Roll | ❌ | `piano-visualizer`, studio piano roll (§8) |
| Practice mode, correctness check | ❌ | `practice-core` (PIANO_VISUALIZER §6) |
| MIDI device input/output | ❌ | `midi-engine` on Web MIDI; native modules on mobile |
| MIDI file import | ❌ | Post‑v1 (Q4 resolved). Later: own converter; a parser such as `@tonejs/midi` (MIT) needs approval then |
| MusicXML export | ❌ | Post‑v1 (Q3 resolved). Later: own exporter from MHD |
| WAV encoding | ❌ (raw float PCM only) | Small encoder in `music-engine` |
| Per-hand mute in a grand staff | ❌ | Playback-score split (§5.2) |
| Sustain pedal playback | ⚠️ | Spike S7; fallback: playback-only lengthening (§5.2) |
| Low-latency monitoring sound for MIDI input | ⚠️ (`playNote` is a one-shot MIDI file, latency unknown) | Spike in Phase 2; fallback: own small sampler on the **Web Audio API** (approved, PROJECT_SPEC §5.1); no extra audio library |
| iOS / React Native rendering | ❌ | `ScoreView` WebView component (MOBILE.md §4.4) |

alphaTab remains the right choice for engraving, synthesis and GP/MusicXML import. No alternative (e.g. VexFlow, OpenSheetMusicDisplay) offers tablature + Guitar Pro import + playback in one library, so no replacement is proposed.

## 3. Canonical document model — MusicHub Document (MHD)

Defined in `packages/music-model` as TypeScript types + Zod schemas. JSON file extension `.mhd.json`. Design goals: lossless for everything the editor supports, close to the GP/alphaTab hierarchy (minimal impedance), stable string IDs, explicit schema version, no derived data stored.

### 3.1 Time base

- `PPQ = 960` ticks per quarter note (equal to alphaTab's `MidiUtils.QuarterTime`).
- Notation durations are **rhythmic values**, not ticks: `{ value: 1|2|4|8|16|32|64|128, dots: 0|1|2, tuplet?: { actual: n, normal: m } }`. Ticks are derived.
- Milliseconds are always derived from the tempo map; never stored.

### 3.2 Structure

```ts
type MhdDocument = {
  format: 'musichub';
  schemaVersion: 1;
  id: DocumentId;                     // lowercase UUIDv7: composition id when synced, client-generated before
  meta: { title: string; subtitle?: string; artist?: string; album?: string;
          composer?: string; lyricist?: string; transcriber?: string; copyright?: string;
          notes?: string };
  masterBars: MasterBar[];            // shared bar-level data, index = bar number (1..5000)
  tracks: Track[];                    // 1..64
  extensions?: Record<string, JsonValue>; // keys `vendor.name`; preserved verbatim on save
};

type MasterBar = {
  id: MhdId;
  timeSignature?: { numerator: number /* 1..32 */; denominator: 1|2|4|8|16|32 }; // only when it changes
  keySignature?: { fifths: number /* -7..7 */; mode: 'major' | 'minor' };
  tempoChanges?: { position: Position; bpm: number /* quarter notes, 20..400 */; label?: string }[];
  tripletFeel?: 'none' | '8th' | '16th' | 'dotted8th' | 'dotted16th' | 'scottish8th' | 'scottish16th';
  repeatStart?: true;
  repeatEnd?: { count: number };      // total plays, 2..99
  alternateEndings?: number[];        // passes 1..99, e.g. [1], [2,3]
  section?: { letter?: string; text: string };
  direction?: 'segno' | 'segnoSegno' | 'coda' | 'doubleCoda' | 'fine' | 'daCapo' | 'daCapoAlFine'
            | 'daCapoAlCoda' | 'dalSegno' | 'dalSegnoAlFine' | 'dalSegnoAlCoda' | 'toCoda';
  fermatas?: { position: Position; type?: 'short' | 'long' }[]; // ≥ 1 entry; absent type = standard fermata
  isAnacrusis?: true;                 // pickup bar (only bar 0)
};

type Track = {
  id: MhdId; name: string; shortName?: string;
  color: `track.${1|2|3|4|5|6|7|8|9|10|11|12}`; // design-token palette id, never hex
  instrument: { family: InstrumentFamily; midiProgram: number /*0-127*/; bank?: number /*0-16383*/; percussion: boolean };
  mixer: { volume: number /*0..1*/; pan: number /*-1..1*/; mute: boolean; solo: boolean };
  staves: Staff[];                    // 1 for guitar, 2 for piano grand staff, …
};

type Staff = {
  id: MhdId;
  display: { standard: boolean; tab: boolean; slash: boolean; numbered: boolean };
  stringed?: { tuning: number[] /* 4..10 MIDI pitches, highest string first */; capo: number; fretCount: number };
  transpositionPitch?: number;        // e.g. -12 for guitar written an octave higher
  hand?: 'left' | 'right';            // keyboard staves; default for a 2-staff keyboard track: upper = right, lower = left
  bars: Bar[];                        // length === masterBars.length (invariant)
};

type Bar = { id: MhdId; clef?: 'G2' | 'F4' | 'C3' | 'C4' | 'neutral';
             ottava?: '15ma'|'8va'|'8vb'|'15mb'; // display-only octave line over this bar (see below)
             sustainPedal?: { position: Position; type: 'down' | 'up' }[]; // keyboard staves
             voices: Voice[] /* 1..4, voice 0 primary */ };

type Voice = { id: MhdId; beats: Beat[] };

type Duration = { value: 1|2|4|8|16|32|64|128; dots: 0|1|2; tuplet?: { actual: number /*2..15*/; normal: number /*1..15*/ } };

type Beat = {
  id: MhdId;
  duration: Duration;
  rest: boolean;                      // true ⇔ notes = []
  notes: Note[];                      // a chord is several notes in one beat
  grace?: 'beforeBeat' | 'onBeat';
  dynamic?: 'ppp'|'pp'|'p'|'mp'|'mf'|'f'|'ff'|'fff';
  text?: string; lyrics?: string[];
  effects?: { vibrato?: 'slight'|'wide'; tremoloPicking?: 8|16|32; pickStroke?: 'up'|'down';
              brush?: { direction: 'up'|'down'; duration?: Duration /* rhythmic span; absent = engine default */ };
              tap?: true; slap?: true; pop?: true; fadeIn?: true; whammy?: BendPoint[]; crescendo?: 'crescendo'|'decrescendo' };
};

type Note = {
  id: MhdId;
  // Pitch: exactly one authority. Stringed staves: string+fret is authoritative, pitch derived from tuning+capo.
  string?: number;                    // 1 = highest string
  fret?: number;                      // 0..36
  pitch?: number;                     // MIDI 0-127; authoritative on non-stringed staves; GM percussion key on percussion tracks
  spelling?: { step: 'C'|'D'|'E'|'F'|'G'|'A'|'B'; alter: -2|-1|0|1|2 }; // optional, for notation accidentals
  drumTechnique?: DrumTechnique;     // percussion only; must be allowed for pitch (see below)
  velocity?: number;                  // 1..127, default from dynamic
  hand?: 'left' | 'right';            // overrides Staff.hand (cross-staff passages)
  tiedFromPrevious?: true;            // continues the previous note of the same pitch (tie destination)
  effects?: { bend?: BendPoint[]; slideOut?: 'shift'|'legato'|'outUp'|'outDown'; slideIn?: 'intoFromBelow'|'intoFromAbove';
              hammerPullOrigin?: true; palmMute?: true; letRing?: true; deadNote?: true; ghost?: true;
              staccato?: true; accent?: 'normal'|'heavy'; harmonic?: { type: 'natural'|'artificial'|'pinch'|'tap'|'semi'|'feedback'; fret?: number };
              vibrato?: 'slight'|'wide'; trill?: { fret: number; speed: 16|32|64 }; fingering?: { left?: number; right?: 'p'|'i'|'m'|'a'|'c' } };
};

type MhdId = string;                  // 12 characters base62, unique in the document
type DocumentId = string;             // lowercase UUIDv7
type Position = [number, number];     // reduced fraction of the bar length in [0, 1); zero is [0, 1]
type BendPoint = { offset: number /*0..60, 60ths of the note duration*/; value: number /* quarter tones */ };
type InstrumentFamily = 'guitar'|'bass'|'piano'|'drums'|'vocals'|'strings'|'brass'|'woodwinds'|'synth'|'other';
type DrumTechnique = 'halfOpen' | 'rimshot' | 'edge' | 'choke';
```

- **Optional flags** are `true` or absent; `false` is rejected so a state has one spelling. Required booleans (`rest`, `percussion`, `mute`, `solo`, `display.*`) keep `true`/`false`.
- **Keyboard tracks** are the families `piano` and `synth`: only they may use `hand` and `sustainPedal`, with one or two staves.
- **Percussion:** `pitch` is always the General MIDI percussion key; it selects the instrument and sound. `drumTechnique` is optional and adds only what GM has no key for. Each technique is allowed for these GM keys: `halfOpen` 42/46, `rimshot` 38/40, `edge` 51/59, `choke` 49/52/55/57 (crash 1, china, splash, crash 2). Absent means the plain GM sound (e.g. 42 closed hi-hat, 46 open hi-hat, 37 side stick, 53 ride bell need no technique). A `drums` track has `percussion: true`; other families may also be percussion tracks.
- **Half-open hi-hat key** (owner decision 2026‑11‑25, ADR-0002 A12): the timeline reports the GM key stored in `pitch`; a note with `pitch: 42` and `drumTechnique: 'halfOpen'` is reported as 42 and never rewritten to 46. Known alphaTab 1.9.0 limitation: its single half-open articulation sounds as GM 46 and cannot tell 42 + `halfOpen` from 46 + `halfOpen`, so audio plays 46 and a GP7 export cannot keep the distinction (S2 report §5.3, §9). Timeline parity tests keep this as a documented exception.
- **Repeats and navigation** (playback order; owner decisions 2026‑11‑25, ADR-0002 A10, A13). `repeatEnd.count` is the total number of plays; an ending bar is played only in the passes it lists; D.C. jumps to the start, D.S. to the segno, "al Fine" stops at Fine, "al Coda" goes to the coda at To Coda; a `repeatEnd` without `repeatStart` follows §3.3 invariant 7. In addition:
  1. After a D.C. or D.S. jump, repeats play only their final pass.
  2. A jump inside a repeated section is taken on its last pass only.
  3. To Coda and Fine are ignored before the jump.

  Invariants 14 and 15 (§3.3) reject the cases these rules do not cover. For a `repeatEnd` without its own start after an earlier repeat, alphaTab 1.9.0 plays a different order (S5 finding D1); the adapter may set an implicit `repeatStart` in the **Playback Score only** to reproduce the MHD order, leaving the Render Score unchanged (§5.2). This approach is **not yet verified** against alphaTab; Phase 1 must verify it with a parity test and report a failure to the owner instead of changing these semantics.
- **Default dynamic (open):** MHD v1 does not define the dynamic before the first `Beat.dynamic`, so `Note.velocity`'s "default from dynamic" is undefined there. The adapter currently assumes *f*; that is not an MHD rule. Decided during Phase 1 MHD v1 finalisation (ADR-0002 A15): *f* as the MHD default, or the default stays with the adapter. Velocity parity with alphaTab (velocity from dynamics) depends on it.
- **Brush** duration is an MHD `Duration`, so it does not depend on PPQ or an engine.
- **Ottava** (`Bar.ottava`, decision Q-D): an octave line over every beat of every voice of the current bar on that staff. It applies to this bar only and never carries into the next bar; drawing consecutive bars as one continuous line is a rendering choice, not MHD semantics. Display only: `Note.pitch`, and the pitch derived from string and fret, is always the sounding pitch and is never rewritten by `ottava`; only the written position moves. It is distinct from a clef ottava (MHD has none; a written-octave instrument uses `Staff.transpositionPitch`). The adapter maps it to alphaTab `Beat.ottava` on every beat, including grace beats, never to `Bar.clefOttava`; alphaTab plays the stored pitch unchanged.
- **Fermatas** (`MasterBar.fermatas`, decision Q-E): a fermata belongs to the master bar and applies to every track and staff at its `position`. Positions use the same coordinate system as tempo changes and pedal positions: a reduced fraction of the nominal bar length of the time signature in `[0, 1)`, also in a pickup bar. Several fermatas per bar are allowed. A missing `type` is a standard (medium) fermata. MHD stores no playback duration or multiplier; the adapter never rounds or moves a fermata whose position is not an integer alphaTab tick or not a beat start, it reports a diagnostic instead.
- Numeric limits not listed here are documented in `packages/music-model/README.md`. They are MHD sanity limits, never engine limits.
- Chord diagrams (`Beat.chordId`, `Track.chords`) and score-wide styling are not part of v1. They are decided with the Phase 3 editor; until then they live in `extensions['alphatab.unmapped']` (see §4.2).

### 3.3 Invariants (checked by `validateDocument(doc)` in music-model)

Each invariant has stable issue codes (`ISSUE_CODES`); see `packages/music-model/README.md`.

1. All element `id`s (12 characters base62, generated with `crypto.getRandomValues`) are unique within the document. The document `id` is a UUIDv7 (§3.2).
2. Every staff has `bars.length === masterBars.length`.
3. A bar's voices may be *incomplete* (sum < time signature) while editing; overfull voices are invalid. Incompleteness is reported as a warning, playback fills with rests. Grace beats take no time of their own; empty secondary voices (index ≥ 1) produce no warning; a pickup bar 0 (`isAnacrusis`) is not incomplete.
4. Stringed staff notes have `string` ∈ [1, tuning.length] and `fret` ∈ [0, fretCount]; no two notes on the same string in one beat; `capo` ≤ `fretCount`; every note has exactly one pitch authority.
5. `rest === true ⇔ notes.length === 0`.
6. `tiedFromPrevious` only if the previous beat in the same voice contains the same pitch. The previous beat may be in the previous bar.
7. Repeat and direction structure is well-formed: repeats are not nested (a repeat start must be closed before the next one); a `repeatEnd` without `repeatStart` is allowed and repeats from the start of the piece or the previous repeat end; jump targets exist: `dalSegno*` needs `segno`, `*AlCoda` needs `toCoda` and `coda`, `toCoda` needs `coda`, `*AlFine` needs `fine`.
8. `masterBars[0]` defines `timeSignature`, `keySignature` and a tempo change at position `[0,1]`; a staff's bar 0 may omit `clef` (it is derived from the instrument). Later bars only carry changes: repeating the current time signature or key signature is an error. Tempo is not checked by this rule (the same bpm may come with a new label). Only bar 0 may be a pickup.
9. Alternate endings belong to the repeat closed in their group (consecutive bars with endings; a bar that opens the next repeat ends the group). Numbers are unique within the group (a multi-bar ending repeats its numbers on consecutive bars) and do not exceed the repeat count.
10. `hand` and `sustainPedal` only on keyboard tracks (`piano`, `synth`); a keyboard track has one or two staves.
11. Tempo change, pedal and fermata positions strictly increase within a bar; the pedal alternates down/up across the staff (it may stay down to the end).
12. A tie on a stringed staff keeps the same `string` and `fret`.
13. Percussion notes have no `string` or `fret`; `drumTechnique` only on percussion tracks and only with a GM key allowed for it.
14. Every pass before the final pass of a repeat reaches a played repeat end of its ending group: the closing bar's `alternateEndings`, if present, list every pass from 1 to count − 1. Rejected example: `|: 1 |1. 2 :|(3×) |2.3. 3 | 4` (owner decision D2-a 2026‑11‑25, ADR-0002 A11; the pattern is invalid, alphaTab's playback of it is not MHD semantics).
15. A document has at most one `segno` and at most one `coda` direction (ADR-0002 A14). Documents with several are not supported; their navigation is untested.

Invariants 14 and 15 are decided but not yet implemented in `validateDocument`; Phase 1 implements them and assigns their issue codes.

Further checks: a `drums` track has `percussion: true`; a brush is not longer than its beat. Warnings: `fermata-not-on-beat` when no non-grace beat (rests count) of any voice, staff or track starts at a fermata position; `ottava-not-displayed` when `Bar.ottava` is set on a percussion staff or a staff without standard notation.

### 3.4 Versioning & migrations

- `schemaVersion` is an integer. **Every change to the schema structure increments it, including a new optional field or enum value.** MHD schemas are strict and clients reject unknown keys, so an "additive" change without a new version would make older clients fail with a schema error instead of the update prompt.
- **Before the first public release of MHD v1**, while no saved documents exist, the v1 schema may still change without a version bump. From the first public release (or the first saved document, whichever comes first) the rule above applies to every structural change.
- `music-model/migrations/vN_to_vN+1.ts` pure functions; `migrate(doc)` upgrades step-by-step on load. Downgrades are not supported; older clients receive `422 unsupported_schema_version` style errors locally and are prompted to update.
- `extensions` are preserved verbatim through load/save by every client.
- Golden fixtures for each schema version live in `music-model/fixtures/v<N>/`.
- The JSON Schema of each version is generated from Zod (`createMhdJsonSchema()`) and committed as `packages/music-model/json-schema/mhd-v<N>.schema.json`. It describes structure only; refinements and the invariants of §3.3 are runtime-only (`validateDocument`).

### 3.4a Templates

`music-model/templates` provides the starting documents for "New composition" (electric guitar, bass, piano grand staff, band: guitar + bass + drums, empty). They are used by web and mobile; the server never builds documents.

### 3.5 Derived data (never stored)

`music-model/timeline` computes from a document:

- **Tempo map** and tick ↔ ms conversion.
- **Playback order**: master bar sequence after expanding repeats, alternate endings and directions.
- **Note events**: `{ noteId, trackId, staffId, hand, pitch, startTick, durationTicks, startMs, durationMs, velocity, playIndex }` after resolving ties (tied notes merge), grace notes, capo and transposition. Used by PIANO_VISUALIZER, practice-core, Piano Roll and MIDI out.
- **DerivedMeta** for the API (`summary`, `tracks`; API.md §5).
- **Fermata playback**: how long a fermata holds is a timeline / playback engine policy, not MHD data and not alphaTab (alphaTab 1.9 draws fermatas but its MIDI generator ignores them).

### 3.6 Shared runtime contracts (`music-model/contracts`)

Interfaces only, so consumers do not depend on alphaTab or Web MIDI:

```ts
interface PlaybackClock { now(): { tick: number; ms: number; playing: boolean; speed: number }; onSeek(cb: (ms: number) => void): Unsubscribe }
interface LiveNoteSource { onNoteOn(cb: (pitch: number, velocity: number, timeStamp: number) => void): Unsubscribe;
                           onNoteOff(cb: (pitch: number, timeStamp: number) => void): Unsubscribe;
                           onSustain(cb: (down: boolean, timeStamp: number) => void): Unsubscribe }
// timeStamp: DOMHighResTimeStamp (same time base as performance.now()); Web MIDI MIDIMessageEvent.timeStamp uses it.
```

⚠️ Our playback-order expansion must match alphaTab's MIDI generation exactly, otherwise visuals and audio diverge (risk R6). Mitigation: golden tests compare our note events against `MidiFileGenerator` output for fixture files (note-on count, pitch, tick).

## 4. Conversion & IO (`music-engine/io`)

### 4.1 Pipelines

```
Import:  file bytes ──ScoreLoader──▶ alphaTab Score ──fromAlphaTab()──▶ MHD + ImportWarning[]
Render:  MHD ──toAlphaTab()──▶ Score ──score.finish(settings)──▶ api.renderScore(score, trackIndexes)
Export:  MHD ──toAlphaTab()──▶ Score ──▶ Gp7Exporter | AlphaTexExporter | MidiFileGenerator→MidiFile.toBinary() | api.exportAudio()→WAV encoder
Native:  MHD ⇄ JSON (.mhd.json), Zod-validated; JSON Schema generated for non-TS consumers
```

`toAlphaTab()` strategy (decided in Phase 0 spike S2):

- **A (default expectation):** construct alphaTab model objects (`Score`, `MasterBar`, `Track`, `Staff`, `Bar`, `Voice`, `Beat`, `Note`) directly, then `score.finish(settings)`. Always build a *fresh* Score per change; never mutate a Score that alphaTab has rendered.
- **B (fallback / oracle):** generate alphaTex text and import with `AlphaTexImporter`. Simpler, documented, but potentially slower and limited to alphaTex-expressible features.

Options: `toAlphaTab(doc, { purpose: 'render' | 'playback' | 'export', tracks, practice? })` (see §5.2). The adapter returns `{ score, idMap }` where `idMap` maps alphaTab objects (`WeakMap<Beat|Note|Bar, string>`) and back (`Map<string, Beat|Note>`) for hit-testing and highlighting.

### 4.2 Coverage & lossiness

- A **feature coverage matrix** (`music-engine/COVERAGE.md`, created in Phase 1) lists each alphaTab model property: mapped / unmapped-preserved / dropped.
- Unmapped alphaTab data needed for faithful re-export is stored in `extensions['alphatab.unmapped']` keyed by MHD id only if it is round-trippable; otherwise dropped with an `ImportWarning`.
- Engine limits and engine units stay in the adapter, never in MHD. Examples: alphaTab stores alternate endings as a 32-bit flag (MHD allows up to 99), so endings above 32 produce an `ImportWarning`/export warning; brush durations are converted between MHD `Duration` and alphaTab ticks in `music-engine` (`PPQ × 4 / value` with dots and tuplet; imported tick values are rounded to the nearest MHD duration with a warning when not exact).
- Percussion is mapped in `music-engine`: the pair (GM `pitch`, `drumTechnique`) ↔ an alphaTab articulation (`DRUM_TECHNIQUES` lists the valid pairs). An alphaTab articulation that no pair represents keeps the GM `pitch`, stores the original alphaTab data in `extensions['alphatab.unmapped']` keyed by the note id, and produces an `ImportWarning`.
- The original uploaded file is retained server-side (DATABASE.md §3.11).
- Golden tests: for each fixture `x.gp`: `import → MHD → export GP7 → import → MHD'`, assert `MHD ≈ MHD'` (ids excluded).
- **S4 disposition** (owner decision 2026‑11‑25, ADR-0002 A17): Phase 1 owns the production `fromAlphaTab` importer, `music-engine/COVERAGE.md` and golden round-trip tests on legally usable MusicXML fixtures; handling of the three recorded import deviations (D.S. al Coda → Dal Segno, U+00A0 in part names, `steal-time-previous` grace timing); MHD decisions on tenuto, slur and the transposing-staff key signature; investigation and handling of the GP7 stringed-staff finding. Phase 7 owns independent GP3–GP8 import evidence from legally usable fixtures (OQ2/OQ3) before v1.0; if none are available, the owner decides how Guitar Pro import is presented at launch. The S4 spike converter is research code, its MusicXML evidence is synthetic, and its GP7 round trip used alphaTab on both sides (not independent compatibility evidence). GP3–GP8 are not evaluated; missing GP evidence is not evidence of incompatibility.

### 4.3 Export features in UI

| Export | Phase | Implementation |
|---|---|---|
| `.mhd.json` | 1 | native |
| Guitar Pro `.gp` | 1 | `Gp7Exporter` |
| MIDI `.mid` | 1 | `MidiFileGenerator` + `MidiFile.toBinary()` |
| alphaTex `.atex` | 1 | `AlphaTexExporter` |
| WAV | 2 | `exportAudio` → 44.1 kHz stereo float32 → 16‑bit PCM WAV encoder (ours) |
| PDF / PNG print | later | browser print of SVG output; investigate later |
| MusicXML | post‑v1 (Q3 resolved) | own exporter from MHD required |

## 5. Playback (`music-engine/playback`)

`PlaybackController` wraps the alphaTab API and exposes a framework-agnostic interface:

```ts
interface PlaybackController {
  state: 'loading' | 'ready' | 'playing' | 'paused';
  load(doc: MhdDocument): Promise<void>;        // via render pipeline (same Score)
  play(): void; pause(): void; stop(): void; seek(tick: number): void;
  setLoop(range: { startTick: number; endTick: number } | null): void; // playbackRange + isLooping
  setSpeed(ratio: number): void;                // playbackSpeed, 0.25–2.0
  setMetronome(volume: number): void; setCountIn(volume: number): void;
  setTrackMix(trackId: string, mix: Partial<Track['mixer']>): void; // changeTrackMute/Solo/Volume
  clock: PlaybackClock;                         // §5.1
  on(event: 'position' | 'activeBeats' | 'state' | 'finished', cb): Unsubscribe;
}
```

- Settings: `player.playerMode = EnabledSynthesizer`, `player.outputMode = WebAudioAudioWorklets`, `player.soundFont = '/alphatab/soundfont/sonivox.sf2'`, cursor enabled, `enableSeekToClick` off in edit mode.
- **Mixer state has one owner:** the persisted mix is document data (`track.mixer`, changed via commands, undoable). Temporary overrides (practice hand mute, solo while listening) are session state in `PlaybackController` and are never saved. The effective mix = document mix ⊕ session overrides, pushed with `changeTrackMute/Solo/Volume`.
- **BPM:** tempo in the score is edited through commands (`masterBar.tempoChanges`). Playback speed (`playbackSpeed`, 0.25–2.0) is a session setting and does not change the document.
- **Autoplay policy:** the AudioContext starts only after a user gesture (first Play). Before that the UI shows "click to enable audio" (risk R17).
- SoundFont upgrade (better piano/guitar samples) is a separate task with **license review** (SF2 must be redistributable).

### 5.1 Playback clock (audio-anchored)

`music-engine` implements `PlaybackClock` (contract in `music-model`, §3.6):

- **Anchor = audio engine time.** Each `playerPositionChanged` event (`currentTime`, `currentTick`, `modifiedTempo`, `isSeek`) is produced by alphaTab's synth as samples are played. It is stored as an anchor `(scoreMs, perfNow)`.
- **Between anchors:** `now().ms = anchor.scoreMs + (performance.now() - anchor.perfNow) × speed − outputLatency + calibrationOffset`. `outputLatency` is not available from alphaTab (no AudioContext access) and is estimated per browser/device plus the user's calibration.
- **Drift control:** when a new anchor differs from the extrapolated value by < 30 ms, slew smoothly (no visual jump); when larger or `isSeek`, snap and emit `onSeek`.
- Clock state is never React state. Consumers poll `now()` in their own `requestAnimationFrame` loop.
- The event frequency and jitter of `playerPositionChanged` are undocumented → spike S6 (PIANO_VISUALIZER §5).
- *S6 finding (alphaTab 1.9.0, [report](docs/spikes/s6-audio-clock-accuracy.md) §7.3):* `currentTime` is elapsed playback time and does not include `playbackSpeed`; `currentTick` does. Provisional recommendation (S6 report §9.2, not a decision): take the score-time anchor from `currentTick` (or `currentTime × speed` from the playback start), not from `currentTime` directly; to be confirmed in Phase 1. S6 measured alphaTab event timing against the browser's audio-frame clock only, not the audio output (no loopback); the rest of this section is unchanged and the S6 criterion in §10 is not verified. *Superseded on 2026-11-25 by the accepted policy below (ADR-0004 Addendum 2): score time is anchored on `currentTime × playbackSpeed` (continuous across speed changes, because alphaTab rescales `currentTime` and emits a seek); `currentTick` is tracked separately.*
- Consumers: cursor overlay, Piano Visualizer, Piano Roll playhead, practice-core.

**Accepted S6 clock policy (owner decision 2026-11-25, ADR-0004 Addendum 2).** This is the behaviour Phase 1 implements in `music-engine` and verifies there. The S6 research model (`spikes/s6-audio-clock/src/clock.ts`) is not production code.

- **Anchors.** Every `playerPositionChanged` event is an anchor `(scoreMs, perfNow)` with `scoreMs = currentTime × playbackSpeed` (milliseconds on alphaTab's timeline, speed 1). `currentTick` is kept as a separate anchor: alphaTab computes it as `floor((currentTime × speed − tempoChange.time) / msPerTick) + tempoChange.ticks + 1` (an integer, truncated, offset by one tick), and ticks ↔ time needs the tempo map. The two anchors are not interchangeable.
- **Interpolation.** While playing and after a valid anchor: `scoreMs(t) = anchor.scoreMs + (t − anchor.perfNow) × playbackSpeed` (+ the remaining slew offset), clamped to the end of the score. The `− outputLatency + calibrationOffset` terms above stay a Phase 2 calibration topic.
- **Corrections.** A new anchor that differs from the displayed value by less than **30 ms** (playback time) is **slewed**: the display stays continuous and the difference is absorbed at **10 %** of elapsed playback time. A difference of **30 ms or more snaps** immediately. This replaces the "< 30 ms slew, larger snap" rule above with its now-defined slew rate; the threshold is unchanged.
- **Update interval.** `positionUpdateIntervalInMilliseconds = 0` for WebKit/Safari; `10` (alphaTab's default) for Chromium and other browsers. alphaTab reads the value when the audio worklet is created at `play()`, so it applies from the next playback start.
- **Before the first anchor.** After play, resume or any seek the clock **holds** its position and does not extrapolate until the first valid main-playback anchor arrives. alphaTab emits no position events during a count-in.
- **Lifecycle** (alphaTab 1.9.0): an `isSeek` event snaps the clock and starts a new wait for an anchor. Pause freezes the clock, and alphaTab then resets the position to the start of the current beat (a backward seek). Stop freezes it, and alphaTab resets it to the playback-range start or 0. Loop: `finished`, then a seek to the range start. A speed change is a seek with rescaled `currentTime`, so the score time stays continuous. The end of the score is clamped. Out-of-order events are rejected and exact duplicates ignored.
- **User-visible consequences** (from the historical runs): a wait of **139–345 ms** between the play state and the first anchor, during which the position holds; occasional **snaps of 30 ms or more**, including one of about **300 ms** during the recorded WebKit stall; on pause, a **backward jump to the beginning of the current beat** (alphaTab behaviour); otherwise smooth catch-up of corrections below 30 ms.
- **Evidence and its limits.** The offline replay of the 18 historical S6 runs ([REPLAY.md](spikes/s6-audio-clock/REPLAY.md)) measured the clock error at animation frames against each run's fitted audio-frame timeline (worst WebKit p99 at interval 0: 9.54 ms; three runs). 17 synthetic lifecycle tests (`spikes/s6-audio-clock/src/clock.test.ts`) cover count-in, first anchor, interpolation, slew, snap at and above the threshold, seek, speed change, pause and its reset, resume, stop, end clamping, loop, missing or delayed events, out-of-order and duplicate events. They test the model's rules, not browser behaviour. Not verified: physical audio-output accuracy (no loopback), real Safari, Firefox, mobile and other hardware, the CPU and message cost of interval 0, speed changes, pauses, loops and count-in in recorded data, and output latency (Phase 2 calibration).

### 5.2 Playback-score variants

Because alphaTab mutes only whole Tracks and appears not to play sustain pedals, `toAlphaTab(..., { purpose: 'playback' })` may build a playback Score that differs from the render Score. It is rendered nowhere; it is loaded into the player only. Whether alphaTab can play a Score different from the rendered one is spike S7. If it cannot, the variant is used for rendering as well, in practice mode only.

| Variant | When | Transformation |
|---|---|---|
| Hand split | Practice mode with one hand muted | Each keyboard staff becomes its own alphaTab Track with its own MIDI channel, so the hand can be muted with `changeTrackMute` |
| Pedal | A keyboard staff has `sustainPedal` and S7 confirms no pedal playback | Notes under a pedal are lengthened until pedal-up (playback only; notation untouched) |
| Implicit repeat start | A `repeatEnd` without its own `repeatStart` after an earlier repeat (§3.3 invariant 7, ADR-0002 A10) | `repeatStart` set on the bar after the previous repeat end (Playback Score only; not yet verified against alphaTab) |

S7 answered the first question (A7: not natively, through the `midiLoad` hook). The pedal and hand-split variants are untested; by owner decision 2026‑11‑25 (ADR-0002 A18) Phase 1 checks audibly whether alphaTab plays the sustain pedal and implements the pedal variant if it does not, and Phase 2 builds the hand-split variant and verifies one-hand practice audibly.

## 6. Render controller & edit loop

```
editor-core command ─▶ new immutable MHD (structural sharing)
     ─▶ RenderScheduler (coalesce per animation frame, min 50 ms between renders while typing)
     ─▶ toAlphaTab(doc, visibleTrackIds) ─▶ score.finish() ─▶ api.renderScore(score, trackIndexes)
     ─▶ renderFinished ─▶ rebuild hit-test index from boundsLookup ─▶ redraw caret/selection overlay
```

- Only visible tracks are passed in `trackIndexes`.
- Playback across re-render: a new Score triggers `loadMidiForScore()`, which **stops playback** (verified in source). Therefore an edit during playback stops playback. The controller stores `tickPosition` before rendering and restores it after `midiLoaded`. Auto-resume is off by default. Re-render latency including MIDI regeneration is measured in S3. The S3 acceptance interval (edit command received → first painted frame showing the edit, p95 < 150 ms on 300 × 8) and the separate MIDI-readiness metric are defined in ADR-0002 A9.
- Fallbacks if spike S3 shows unacceptable latency on 300-bar scores: (1) `Horizontal` layout in edit mode, (2) render window of N bars around caret using `display.startBar`/`barCount`, (3) render edited track only. Selecting one is governed by the fallback policy of ADR-0002 A9; none is selected (S3's historical measurements put all three above 150 ms on 300 × 8).
- **S3 disposition** (owner decision 2026‑11‑25, ADR-0002 A16): the S3 gap is placed in Phase 3 (Editor). There, with the real `editor-core` and RenderScheduler, the edit loop is measured under the unchanged A9 on the 300 × 8 reference document; MIDI readiness and playback-position restoration are reported separately from the 150 ms interval. S3 closes only through an A9 pass or an A9-compliant fallback that the owner explicitly selects and accepts.
- **Phase 1 architecture constraint** (ADR-0002 A16): Phase 1's `toAlphaTab`, render-controller and Playback Score architecture must not preclude a partial Render Score, off-main-thread conversion, or MIDI regeneration on play. These are options to keep feasible for the Phase 3 evaluation, not approved or measured optimisations; Phase 1 does not implement them.
- Rendering errors (`error` event) are caught, reported to Sentry with document hash, and the last good render stays visible.

## 7. Editing (`editor-core`)

- All mutations are **commands**: `{ type, payload } → (doc) => { doc', inverse }`. Pure, serialisable, unit-tested. Undo/redo stacks hold inverses; command log also used for local draft recovery.
- **Selection model:** `{ trackId, staffId, barIndex, voiceIndex, beatId?, noteId?, string? }` caret + range selection (bar/beat range across tracks).
- **Tab entry:** caret on a string; digits enter frets (two-digit with timeout 600 ms); arrows move caret; `+`/`-` change duration; shortcuts for techniques (H, P, S, B, palm mute…). Keyboard map defined in editor-core, rendered in UI help.
- **Notation entry:** letter keys A–G set pitch (nearest octave), up/down semitone, Ctrl+up/down octave; MIDI step entry (§9) inserts pitches at caret. On stringed staves, notation-entered pitches get string/fret assigned by a *fret-assignment* algorithm (lowest fret, string preference configurable).
- **Bar operations:** insert/delete bar (affects masterBars and all staves atomically), time/key signature, tempo, repeats, sections.
- **Track operations:** add/remove/reorder tracks, instrument, tuning (with re-pitch or keep-fret option), capo.
- Commands keep invariants (§3.3); `validateDocument` runs in dev builds after every command.

## 8. Piano Roll

The canonical model is **notation-first** (beats with rhythmic values). The piano roll is a *projection*:

- **View:** note events from `timeline` (score order, no repeat expansion in edit view), per track, pitch × tick grid, velocity lane.
- **Edit:** user edits (draw, move, resize, delete, velocity) are converted into commands on beats using the current **grid** (1/4 … 1/32, triplets). A drawn note spanning beat boundaries becomes tied notes; overlapping notes in one voice are moved to another voice (max 4) or rejected with a hint.
- Free (unquantised) timing is **not** representable in v1 (risk R9). Recorded MIDI is quantised on commit (§9).
- Rendered with Canvas 2D in `apps/web` using shared hit-testing utilities; it does not depend on alphaTab.

## 9. MIDI (`midi-engine`, plus alphaTab for MIDI files)

| Capability | Phase | Approach |
|---|---|---|
| MIDI file export | 1 | alphaTab `MidiFileGenerator` |
| MIDI device input (Web MIDI `navigator.requestMIDIAccess`) | 2 | `midi-engine` implements `LiveNoteSource`: device picker, hot-plug, note on/off, sustain (CC64). Feature-detected; Chrome, Edge and Firefox support Web MIDI (Firefox asks for a site permission); Safari does not. |
| Live key highlight in visualizer | 2 | Input stream → PIANO_VISUALIZER keyboard state |
| Practice correctness check | 2 | Input stream → `practice-core` (PIANO_VISUALIZER §6). v1 committed for MIDI keyboards |
| MIDI guitar input for correctness checking | research (S8) | **Not a v1 commitment** (Q21). Spike S8 checks real MIDI guitars/pickups: per-string channel mode (mono mode, one channel per string), pitch-bend handling, tracking latency, false triggers, mapping events to string/fret. Enters v1 only after a passing prototype and an owner decision |
| Microphone pitch / chord / rhythm detection | post‑v1 (Audio/AI) | Not in v1 (Q21); see §11a |
| Monitoring sound on input | 2 | ⚠️ `api.playNote` latency unverified → spike; fallback: own lightweight Web Audio API sampler |
| Step entry into editor | 3 | Chord = notes pressed within 50 ms window |
| Recording + quantisation | 5 | Record against playback clock, quantise to grid, convert to commands |
| MIDI device output | 5+ | Own scheduler sends `timeline` note events to a Web MIDI output with look-ahead (25 ms tick, 100 ms horizon); alphaTab synth muted for those tracks. alphaTab cannot target MIDI devices. |
| MIDI file import | post‑v1 (Q4 resolved) | Own SMF parser + quantiser → MHD. MIDI **devices** are not affected: input, practice and highlight stay in Phase 2 |

## 10. Phase 0 spikes (must complete before Phase 1 code)

**Q0 (owner decision 2026-11-25, Option C; ROADMAP.md §Phase 0).** "Complete" means that each spike either meets its pass criterion below or has a disposition recorded by the owner: an accepted alternative (S3 only under ADR-0002 A9) or an explicit placement of the gap in a named later phase. A disposition does not mean the criterion was met; the pass criteria below are unchanged. No open disposition; Phase 0 was declared complete by the owner on 2026-11-25 (ROADMAP.md §Phase 0). Phase 1 is not approved. S7's disposition was recorded on 2026-11-25 (ADR-0002 Amendment 8: sustain pedal in Phase 1, hand split in Phase 2); its pass criterion is not met. S4's disposition was recorded on 2026-11-25 (ADR-0002 Amendment 7: Phase 1 importer and MusicXML work, Phase 7 independent GP3–GP8 evidence); its pass criterion is not met. S3's disposition was recorded on 2026-11-25 (ADR-0002 Amendment 6: gap placed in Phase 3, Phase 1 architecture constraint); its pass criterion is not met. S5's open semantics were decided on 2026-11-25 (ADR-0002 Amendment 5); its pass criterion still needs the Phase 1 parity tests. S6 is decided through the accepted fallback (§5.1), its pass criterion unverified.

| ID | Question | Pass criteria |
|---|---|---|
| S1 | alphaTab 1.9.0 in Next.js 16 + Turbopack: render, worker, worklet playback, prod build, theming via `display.resources` | Renders + plays in Chrome/Firefox/Safari; documents whether the render worker is active |
| S2 | `toAlphaTab` strategy A vs B on fixtures | Correct render for fixture set; time for 300-bar 8-track doc |
| S3 | Edit-loop latency: re-render after single note change; player position preservation | Measured numbers recorded in ADR; < 150 ms target or fallback selected (target, methodology and fallback policy defined in ADR-0002 A9) |
| S4 | Import fidelity: 20 public-domain/own GP3–8 + MusicXML files → MHD → GP7 round-trip | Coverage matrix drafted |
| S5 | Timeline parity vs `MidiFileGenerator` (repeats, endings, D.S./coda, ties, grace) | 100 % note-on parity on fixtures |
| S6 | Clock accuracy: `playerPositionChanged` frequency and jitter; per-browser output latency | Interpolated clock error < 10 ms vs a reference (Playwright + audio loopback, or manual metronome tap test) |
| S7 | Playback-score variants: can the player play a Score that differs from the rendered one? Is the sustain pedal audible? Hand split via separate tracks/channels | Decision recorded; one-hand practice audible correctly |
| S8 | **Runs in Phase 2, not Phase 0** (needs `midi-engine` + `practice-core`). MIDI guitar (optional, needs hardware; Q21): does `midi-engine` + `practice-core` give reliable correctness with common MIDI guitar systems? | Report: per-device compatibility, latency, error rate. **Owner decision** whether MIDI-guitar checking enters v1 |

**Results (recorded 2026-11-24, S2-12; owner dispositions added through 2026-11-25; pass criteria above unchanged).** Index with sources: ADR-0002 Amendment 4.

| ID | Status | Recorded in |
|---|---|---|
| S1 | Done | ADR-0004 |
| S2 | Done (Strategy A, decision A1) | ADR-0002 A1–A6, Amendment 4 |
| S3 | Partly done: < 150 ms not met on 300 × 8, no fallback selected. Owner disposition 2026-11-25: gap placed in Phase 3 (real `editor-core` + RenderScheduler, measured under the unchanged A9 on 300 × 8); Phase 1 must keep a partial Render Score, off-main-thread conversion and MIDI regeneration on play feasible (§6). Pass criterion not met | ADR-0002 Amendment 3 (A9), Amendment 6 (A16) |
| S4 | Partly done: 14 synthetic MusicXML fixtures, GP3–GP8 not evaluated; criterion not met. Owner disposition 2026-11-25 (Option 2): Phase 1 owns the production importer, coverage matrix, MusicXML golden round-trip tests and the recorded findings; Phase 7 owns independent GP3–GP8 evidence before v1.0 (§4.2). Pass criterion not met | ADR-0002 Amendment 4, Amendment 7 (A17) |
| S5 | Done for defined semantics (17 of 19 scenarios at 100 %). Owner decisions 2026-11-25: D1 kept with implicit Playback Score start (unverified), D2 rejected by validation, hi-hat reports the MHD key, [CONV] 1–3 adopted, at most one segno and one coda; default dynamic open (Phase 1). Pass criterion not met until Phase 1 parity tests pass under these rules | ADR-0002 Amendment 4, Amendment 5 |
| S6 | Pass criterion above not verified (no audio reference); fallback accepted by the owner on 2026-11-25 (§5.1), which meets ROADMAP Phase 0 exit criterion 3 | ADR-0004 Addendum, Addendum 2 |
| S7 | Done (playback mechanism A7–A8); sustain pedal and hand split not covered. Owner disposition 2026-11-25 (Option B1): Phase 1 verifies sustain-pedal playback (§5.2 pedal variant if needed), Phase 2 builds and audibly verifies the hand split. Pass criterion not met | ADR-0002 Amendment 2, Amendment 8 (A18) |

Spikes run in Sprint 2 (ROADMAP.md). Spike code lives in `spikes/` (never imported by apps) and is deleted or promoted after the ADR is written.

## 11a. Post‑v1 Audio/AI phase (not in v1, Q21)

To be researched and specified separately after v1, with no implementation in v1:
- Pitch detection from a microphone (acoustic or electric guitar, other instruments).
- Recognition of single notes and chords (polyphonic).
- Rhythm/onset detection.
- Detection of performance errors.
- Comparison of the user's performance with the original part (alignment with MHD `NoteEvent`s).

Design hooks that already exist and stay stable:
- `practice-core` evaluates an abstract stream of played notes (`LiveNoteSource`), so a future microphone-based source can feed the same evaluator.
- Practice sessions record `input_source` (DATABASE.md §3.15), so a future `microphone` value needs only a CHECK-list extension.

## 11. Engine-specific risks

See PROJECT_SPEC.md §8 (R1–R19). Additional:

- **E1** — alphaTab IDs (`Score.resetIds`) are runtime-only; never persist them or send them to the server.
- **E5** — Edits during playback stop playback (MIDI reload). This is acceptable UX for v1; it is documented in the studio help.
- **E2** — alphaTab worklet loads ~2.5 MB unminified core under Turbopack; first-play latency. Preload after first interaction; CDN caching.
- **E3** — Bundled SONiVOX SoundFont quality may disappoint piano users; budget for a licensed SoundFont.
- **E4** — Upgrade risk: generated model classes change between versions; adapter tests must pin behaviour; upgrade only via dedicated task with license review.
