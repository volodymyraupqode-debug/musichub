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
- *S6 finding (alphaTab 1.9.0, [report](docs/spikes/s6-audio-clock-accuracy.md) §7.3):* `currentTime` is elapsed playback time and does not include `playbackSpeed`; `currentTick` does. Provisional recommendation (S6 report §9.2, not a decision): take the score-time anchor from `currentTick` (or `currentTime × speed` from the playback start), not from `currentTime` directly; to be confirmed in Phase 1. S6 measured alphaTab event timing against the browser's audio-frame clock only, not the audio output (no loopback); the rest of this section is unchanged and the S6 criterion in §10 is not verified.
- Consumers: cursor overlay, Piano Visualizer, Piano Roll playhead, practice-core.

### 5.2 Playback-score variants

Because alphaTab mutes only whole Tracks and appears not to play sustain pedals, `toAlphaTab(..., { purpose: 'playback' })` may build a playback Score that differs from the render Score. It is rendered nowhere; it is loaded into the player only. Whether alphaTab can play a Score different from the rendered one is spike S7. If it cannot, the variant is used for rendering as well, in practice mode only.

| Variant | When | Transformation |
|---|---|---|
| Hand split | Practice mode with one hand muted | Each keyboard staff becomes its own alphaTab Track with its own MIDI channel, so the hand can be muted with `changeTrackMute` |
| Pedal | A keyboard staff has `sustainPedal` and S7 confirms no pedal playback | Notes under a pedal are lengthened until pedal-up (playback only; notation untouched) |

## 6. Render controller & edit loop

```
editor-core command ─▶ new immutable MHD (structural sharing)
     ─▶ RenderScheduler (coalesce per animation frame, min 50 ms between renders while typing)
     ─▶ toAlphaTab(doc, visibleTrackIds) ─▶ score.finish() ─▶ api.renderScore(score, trackIndexes)
     ─▶ renderFinished ─▶ rebuild hit-test index from boundsLookup ─▶ redraw caret/selection overlay
```

- Only visible tracks are passed in `trackIndexes`.
- Playback across re-render: a new Score triggers `loadMidiForScore()`, which **stops playback** (verified in source). Therefore an edit during playback stops playback. The controller stores `tickPosition` before rendering and restores it after `midiLoaded`. Auto-resume is off by default. Re-render latency including MIDI regeneration is measured in S3.
- Fallbacks if spike S3 shows unacceptable latency on 300-bar scores: (1) `Horizontal` layout in edit mode, (2) render window of N bars around caret using `display.startBar`/`barCount`, (3) render edited track only.
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

| ID | Question | Pass criteria |
|---|---|---|
| S1 | alphaTab 1.9.0 in Next.js 16 + Turbopack: render, worker, worklet playback, prod build, theming via `display.resources` | Renders + plays in Chrome/Firefox/Safari; documents whether the render worker is active |
| S2 | `toAlphaTab` strategy A vs B on fixtures | Correct render for fixture set; time for 300-bar 8-track doc |
| S3 | Edit-loop latency: re-render after single note change; player position preservation | Measured numbers recorded in ADR; < 150 ms target or fallback selected |
| S4 | Import fidelity: 20 public-domain/own GP3–8 + MusicXML files → MHD → GP7 round-trip | Coverage matrix drafted |
| S5 | Timeline parity vs `MidiFileGenerator` (repeats, endings, D.S./coda, ties, grace) | 100 % note-on parity on fixtures |
| S6 | Clock accuracy: `playerPositionChanged` frequency and jitter; per-browser output latency | Interpolated clock error < 10 ms vs a reference (Playwright + audio loopback, or manual metronome tap test) |
| S7 | Playback-score variants: can the player play a Score that differs from the rendered one? Is the sustain pedal audible? Hand split via separate tracks/channels | Decision recorded; one-hand practice audible correctly |
| S8 | **Runs in Phase 2, not Phase 0** (needs `midi-engine` + `practice-core`). MIDI guitar (optional, needs hardware; Q21): does `midi-engine` + `practice-core` give reliable correctness with common MIDI guitar systems? | Report: per-device compatibility, latency, error rate. **Owner decision** whether MIDI-guitar checking enters v1 |

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
