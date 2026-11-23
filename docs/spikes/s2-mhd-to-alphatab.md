# Spike S2 — MHD v1 → alphaTab: Strategy A (direct model) vs Strategy B (alphaTex)

- **Task:** ROADMAP.md S2-05 (MUSIC_ENGINE.md §4.1 `toAlphaTab()`, §10 spike S2)
- **Code:** `spikes/s2-mhd-to-alphatab` (isolated workspace package, Node only)
- **Status:** **complete, recommendation pending the owner's decision.** ADR-0002 is not changed.
- **Date:** 2026-11-23

## 1. Goal and scope

Decide experimentally how the future `packages/music-engine` turns an MHD v1 document into an alphaTab `Score`:

- **Strategy A:** build the alphaTab model objects (`Score`, `MasterBar`, `Track`, `Staff`, `Bar`, `Voice`, `Beat`, `Note`) directly and call `score.finish(settings)` once.
- **Strategy B:** generate alphaTex from MHD and import it with `ScoreLoader.loadAlphaTex` (AlphaTexImporter, which calls `finish()` itself).

Evidence counts only when it is checked in the resulting structure, MIDI output or rendering, never because a converter raised no error. Out of scope: production code, `packages/music-engine`, `apps/web`, changes to MHD v1, to ADR-0002 or to the alphaTab version.

| Component | Version |
|---|---|
| alphaTab | `@coderline/alphatab` 1.9.0 (pnpm catalog, unchanged) |
| Node.js | 26.13.1 |
| TypeScript / Vitest / Playwright | 6.0.3 / 5.1.1 / catalog version (Chromium for screenshots only) |

### 1.1 Spike structure

`spikes/s2-mhd-to-alphatab` is a separate package (`@musichub/spike-s2-mhd-to-alphatab`). A shared `spikes/engine` package was not created: S2 needs nothing from S1, and S3–S7 are not approved yet, so a shared package would be speculative. The spike depends on `@coderline/alphatab` and `@musichub/music-model` (workspace), plus catalog dev tools; **no new dependency** was added to the catalog. The canonical fixtures are read from `packages/music-model/fixtures/v1` with `fs` and are never modified. dependency-cruiser and the ESLint spike preset apply unchanged (`pnpm depcruise`: no violations).

**Deviation from the task (documented):** the task asks to use the S1 spike for the visual check, but spikes must not import each other (`no-spike-to-spike`, spikes/README.md). The visual check therefore uses the same alphaTab `ScoreRenderer` headless in Node (SVG engine, documented in MUSIC_ENGINE.md §2.6) and screenshots the SVG in Playwright Chromium with the Bravura font alphaTab ships. S1 stays untouched and its smoke tests still pass.

### 1.2 Files

| File | Purpose |
|---|---|
| `src/strategy-a.ts` | Strategy A converter, builds the `idMap` while constructing |
| `src/strategy-b.ts` | Strategy B: MHD → alphaTex generator + import |
| `src/mapping.ts` | Value mappings shared by both (enums, units, channels, percussion articulations) |
| `src/facts.ts` | Comparable facts from an alphaTab `Score` and, independently, from MHD semantics |
| `src/midi.ts`, `src/render.ts` | MIDI from `MidiFileGenerator`; headless rendering with bounds lookup |
| `src/id-map.ts` | `idMap` and positional recovery for Strategy B |
| `src/synthetic.ts`, `src/performance.ts`, `src/builders.ts` | Synthetic fixtures and the 300 × 8 document |
| `src/*.test.ts` | 142 tests: both strategies on every document, alphaTab findings, id map |
| `scripts/compare.ts`, `bench.ts`, `render.ts` | Reproducible comparison, benchmark, screenshots |

## 2. Strategy A — direct model + `finish()`

Order that works: create all `MasterBar`s and `score.addMasterBar()`; per track `score.addTrack()`, `track.ensureStaveCount(n)`; per staff set display, tuning, capo and transposition, then `staff.addBar()`, `bar.addVoice()`, `voice.addBeat()`, `beat.addNote()`; attach fermatas with `masterBar.addFermata(offset, …)`; finally **one** `score.finish(settings)`. `finish()` computes beat timing (`playbackStart`, `playbackDuration`, `displayDuration`), chains beats and notes across bars, resolves ties (`tieOrigin`), grace groups, tuplet groups, pedal chains and master-bar start ticks.

Invariants Strategy A must ensure itself (each found by a failure, each pinned by a test or the comparison):

1. **Equal voice count per staff.** `Voice._chain` links voice *i* of a bar to voice *i* of the next bar; a missing voice throws a `TypeError` inside `finish()`. alphaTab's own importers pad with placeholder voices (non-public `ModelUtils.appendPlaceholderVoice`: one `isEmpty` quarter beat). A does the same; an empty MHD voice also gets one placeholder beat.
2. **Time signature, key signature and clef on every bar.** MHD stores only changes; alphaTab needs the value in force on each master bar / bar (A carries them forward). The default clef is derived from the instrument (MUSIC_ENGINE.md §3.3 rule 8).
3. **Percussion staff layout.** The alphaTex importer gives a percussion staff six drum-tab "strings" (tuning `[0,0,0,0,0,0]`) and gives each note the first free string; the model API leaves `string` as `NaN`. A replicates both.
4. **Percussion articulations must be registered in `track.percussionArticulations`.** A raw articulation id renders and plays (alphaTab falls back to its table), but `Gp7Exporter` then writes wrong instruments (re-import gave 49, 68, 64… instead of 46, 46, 42…). The table (`PercussionMapper`) is not public; A reads the articulation objects once from a parsed alphaTex percussion track.
5. **alphaTab element ids are global static counters, and every alphaTex import resets them** (`Score.resetIds`). An import in the middle of an A build gave later bars duplicate ids, and `Gp7Exporter` (which keys bars by `Bar.id`) then mixed up bars: D.S./coda playback of the re-imported file grew from 77 to 403 note-ons. A therefore loads the articulation table before creating any object. Consequence for `music-engine`: never interleave a build with an import, and do not rely on alphaTab ids being unique across two live Scores (pinned by a test).
6. **Units:** MHD `transpositionPitch` maps to `Staff.displayTranspositionPitch` (same sign); `Staff.transpositionPitch` would also shift playback. MHD string 1 (highest) = alphaTab string *n* (alphaTab counts from the lowest). Non-stringed pitch is `octave = ⌊p/12⌋`, `tone = p mod 12`. Brush duration is in ticks for the whole chord. alphaTex's natural-harmonic value is derived from the fret (copied table).

## 3. Strategy B — alphaTex + AlphaTexImporter

The generator writes alphaTex 1 (alphaTab 1.9 language) using only syntax confirmed in the parser source and probes: `\track ("name" "short") { color volume balance instrument bank mute solo }`, `\staff { score tabs slash numbered }`, `\tuning`, `\capo`, `\displaytranspose`, `\articulation defaults`, `\voice`, bar metadata (`\ts \ks \clef \ottava \tempo (bpm "label" ratio) \ro \rc \ae \tf \section \jump \ac \spd \spu`), beat properties (`d dd tu gr dy txt lyrics v vw tp su sd bu bd tt s p f tbe cre dec fermata instrument`) and note properties (`t be ss sl sou sod sib sia h pm lr x g st ac hac nh ah ph th sh fh v vw tr lf rf acc`).

Pitfalls found (each pinned by a test):

1. **Unparenthesised metadata arguments are read greedily:** `\section "Groove" D#4{acc default}` takes the note as a second argument and fails. All metadata arguments are parenthesised.
2. **A lone number on a percussion staff is `fret.string`:** `92.8` is fret 92 on string 8. Single articulations are written as one-note chords `(92).8`.
3. **Pitch names force an accidental mode** (`C#4` → ForceSharp); without MHD spelling B adds `{acc default}`.
4. **`tb` spaces whammy values evenly; exact offsets need `tbe`.**
5. **Decimals must round-trip:** a 12-digit `0.333333333333` moved a tempo change from tick 2240 to 2239.99…; B writes the shortest round-trip form.
6. **`instrument percussion` leaves a program-25 instrument automation** on the first beat, so program change 25 goes to the drum channel; B adds a beat-level `instrument 0`.
7. **No syntax for MIDI channels:** the importer assigns them itself (see §5.4).
8. **`displaytranspose` must be explicit:** otherwise the importer applies a default per MIDI program.

The importer reports invalid input with code, line and column in the generated text (e.g. `AT208` for a string out of range), but those coordinates refer to alphaTex, not MHD ids; a source map would be needed to point at the MHD element.

## 4. Test documents

| Document | Kind | Content |
|---|---|---|
| `guitar-basic` | canonical | guitar techniques, tab, capo, tuplets, grace, two voices, tie |
| `piano-grand-staff` | canonical | grand staff, chords, `8va`, tempo change with label, pedal |
| `band-repeats` | canonical | 4 tracks, pickup, repeat + endings, segno / To Coda / D.S. al Coda / coda, drum techniques |
| `multi-voice` | synthetic | 4 voices in one bar, changing voice counts, empty secondary voice |
| `multi-instrument` | synthetic | 9 tracks: 7-string guitar, 5-string bass, strings, brass with bank, woodwinds (numbered), vocals with lyrics, synth (slash), drums; mute/solo/pan |
| `rhythm` | synthetic | pickup, 7/8, 5/4, 12/8 + triplet feel, 6/8 duplet, 3:2, 5:4, 7:8 tuplets, double dots, 128ths, tempo at 1/3 and 3/4 |
| `ties-grace` | synthetic | ties within and across bars, chord ties, grace groups of 1–3, on-beat grace |
| `repeats` | synthetic | three-pass repeat with endings [1,2]/[3], second repeat, endings 1–8 / 9–10 / 11–12 |
| `navigation` | synthetic | segno, segnoSegno, toCoda, fine, dalSegnoAlCoda, coda, doubleCoda, daCapoAlFine, fermata |
| `percussion` | synthetic | every valid (GM key, `drumTechnique`) pair and plain keys |
| `pedal` | synthetic | pedal at 1/3, 2/3, 1/8, 7/16, 5/8, held through bars without markers, synth track |
| `long-sequence` | synthetic | 64 bars: 16ths on guitar, 8ths on piano (1,536 notes) |
| `effects` | synthetic | every note and beat effect, spelling, dynamics, velocity, hand, minor/major keys, all clefs and ottavas |
| `performance-300x8` | performance | 300 master bars, 8 tracks (9 staves), 14,400 beats, 19,425 notes; benchmark input only |

All 14 documents pass `validateDocument` with `valid: true`; the canonical files are unchanged.

## 5. Comparison results

### 5.1 How it was checked

For every document and both strategies (`pnpm compare`, `pnpm test`):

1. The Score builds without error.
2. **Facts vs MHD:** structure, time/key signatures, tempo (bpm, position, label), pickup, repeats, endings, directions, sections, track info (program, bank, volume, balance, mute, solo, percussion), staff display, tuning/capo, transposition, clef, ottava, pedal positions, voices, rhythm in ticks, grace, rests, chords, sounding pitch (`realValueWithoutHarmonic`, string, fret) and ties are extracted from the finished Score and compared with values computed **from MHD semantics alone**.
3. **A vs B:** all fact groups, including dynamics, accidental mode, text/lyrics, every beat and note effect, percussion articulation id and drum-tab string.
4. **Full model diff:** `JsonConverter.scoreToJsObject` of A and B compared field by field (alphaTab id references excluded).
5. **MIDI:** `MidiFileGenerator` output of A and B (note on/off with tick, key, velocity; tempo; program and control changes).
6. **Rendering:** `ScoreRenderer` in Node; rendered master bars, bar bounds, distinct beats and notes with bounds compared with MHD counts; beat bounds of A and B compared; screenshots (§6).
7. **Guitar Pro 7 export:** export, re-import, compare MIDI notes with the original.

### 5.2 Results per document

| Document | A | B | A = B facts | Deviations from MHD (both) | MIDI notes A = B | Rendered bars / beats / notes | ids mapped (A / B) |
|---|---|---|---|---|---|---|---|
| guitar-basic | ok | ok | yes | rhythm (grace) | 17, yes | 8 / 16 / 18 | 49 / 49 |
| piano-grand-staff | ok | ok | yes | none | 20, yes | 6 / 15 / 21 | 55 / 55 |
| band-repeats | ok | ok | yes | percussion (halfOpen) | 77, yes | 40 / 32 / 54 | 166 / 166 |
| multi-voice | ok | ok | yes | none | 24, yes | 6 / 24 / 24 | 71 / 71 |
| multi-instrument | ok | ok | yes | none | 50, yes | 24 / 44 / 50 | 155 / 155 |
| rhythm | ok | ok | yes | rhythm (7:8 ticks) | 47, yes | 7 / 47 / 47 | 117 / 117 |
| ties-grace | ok | ok | yes | rhythm (grace) | 22, yes | 12 / 23 / 29 | 76 / 76 |
| repeats | ok | ok | yes | none | 33, yes | 10 / 10 / 10 | 52 / 52 |
| navigation | ok | ok | yes | none | 30, yes | 8 / 16 / 16 | 58 / 58 |
| percussion | ok | ok | yes | percussion (halfOpen, rimshot 40) | 34, yes | 4 / 32 / 34 | 80 / 80 |
| pedal | ok | ok | yes | none | 12, yes | 12 / 12 / 12 | 57 / 57 |
| long-sequence | ok | ok | yes | none | 1,536, yes | 192 / 1,536 / 1,536 | 3,396 / 3,396 |
| effects | ok | ok | yes | none | 49, yes | 9 / 34 / 37 | 90 / 90 |
| performance-300x8 | ok | ok | yes | percussion (halfOpen) | 29,267, yes | not rendered in tests | 39,842 / 39,842 |

"Rendered bars" counts one bar bound per drawn notation line (notation + tab = 2). Every expected beat and note has rendered bounds in both strategies, and the beat bounds of A and B are identical (position and width) for all 13 rendered documents.

**Full model diff (JsonConverter), A vs B, after the fixes in §2 and §3:** identical except for (a) alphaTab id references (`tieOriginNoteId` etc., global counters), (b) MIDI channel numbers on documents with a drum track (§5.4), and (c) B♯3 / E𝄫4 stored as `octave 4 / tone 12` (B, from the pitch name) vs `octave 5 / tone 0` (A); the sounding pitch, accidental mode and rendering are the same.

**MIDI:** note on/off, tempo and velocity events are identical for all 14 documents. Strict comparison (with channels and program changes) differs only on the three documents with a drum track (§5.4). alphaTab generates **no sustain-pedal (CC 64) events** for either strategy although the pedal is in the model (pinned by a test; audibility is spike S7).

**GP7 round trip:** re-imported MIDI notes equal the original for 12 of 13 documents with both strategies; in `effects` the trill playback changes (4 note-on differences, the same for A and B). Input for spike S4, not a conversion difference.

### 5.3 Deviations shared by both strategies (alphaTab semantics)

| Finding | Evidence |
|---|---|
| A grace beat's value is normalised by group size (1 → eighth, 2 → 16th, ≥ 3 → 32nd); its playback length is fixed (120 ticks for one grace); a before-beat grace takes that time from the **previous** beat (guitar bar 2 rest: 960 → 840 ticks) | `findings.test.ts`, `Beat.finish/updateDurations` |
| Tuplet ticks PPQ 960 cannot represent are truncated (7:8 sixteenth: 274 instead of 274.29) | `findings.test.ts` |
| Half-open hi-hat is one articulation (92) that sounds as GM 46 (open hi-hat): MHD 42 + halfOpen and 46 + halfOpen collapse | `findings.test.ts` |
| No rimshot articulation for GM 40 (electric snare): played and drawn as plain 40 | `findings.test.ts` |
| Alternate endings above 8 are stored in the bitmask but drawn without numbers (`MasterBar.MaxAlternateEndings` = 8); more than 32 cannot be stored | `findings.test.ts`, screenshot `repeats` |
| No CC 64 for the sustain pedal | `findings.test.ts` |
| Invalid MHD (string out of range, overfull bar, missing bar) is accepted silently by A; B rejects only some of it. `validateDocument` must run before either strategy | experiment in `findings.test.ts` |

### 5.4 Differences between the strategies

| Topic | Strategy A | Strategy B |
|---|---|---|
| MIDI channels | Chosen by the adapter (pairs, never 9 for melodic tracks; primaries first when 15 channels are not enough) | Assigned by the importer; it reserves a pair for the percussion track and **puts a melodic track's secondary channel on 9** (drum channel) in `multi-instrument` and `performance-300x8` |
| Drum program change | 0 | 25 unless `instrument 0` is added (pitfall 6) |
| GP7 export of percussion | correct only with registered articulations (invariant 4) | correct |
| ID mapping | recorded while building | positional recovery after import (§7) |
| Invalid input | mostly silent; crashes inside alphaTab (`TypeError`) without element context | diagnostics with code, line, column of the generated text |
| Coupling | to undocumented model conventions (§2 invariants 1–5) | to the alphaTex grammar and importer behaviour (§3) |

## 6. Visual check

`pnpm render` renders A above B for every document into `results/render/<name>.html` and PNG (git-ignored); the canonical screenshots are committed:

- [guitar-basic](s2-mhd-to-alphatab/guitar-basic.png) — notation + tab, hammer-on, bend, brush chord, triplets, palm mute, slide, grace, vibrato, harmonic, second voice (grey), tie.
- [piano-grand-staff](s2-mhd-to-alphatab/piano-grand-staff.png) — grand staff with brace, chords, two voices, `rit.` tempo change, pedal marks, tie.
- [band-repeats](s2-mhd-to-alphatab/band-repeats.png) — 4 tracks, pickup, repeat, endings 1./2., segno, To Coda, D.S. al Coda, coda, fermata, drum noteheads, alphaTab attribution.

A and B look the same in all 13 screenshots; no notes, voices, tracks or bars are missing, the grand staff stays one track with two staves, repeats and endings are drawn. The SVG text of A and B is not byte-identical (one path group in `band-repeats` differs in geometry; all drawn texts and beat bounds are equal); no visible difference was found. A correct rendering is not taken as proof of semantic equality; §5 is the evidence.

Rendering notes: MHD `Bar.ottava` is mapped to the clef ottava (`Bar.clefOttava`, also what alphaTex `\ottava` sets), which draws the notes an octave or two lower under an "8"/"15" clef (screenshot `effects`); whether MHD means a clef ottava or an 8va line is an open question (§12).

## 7. ID mapping

- alphaTab ids (`Bar.id`, `Voice.id`, `Beat.id`, `Note.id`) are **global static counters**: different for every new Score, reset by every alphaTex import, and therefore unusable as keys (tests). There is no free field on the model for a foreign id.
- A separate map is required. The spike's `idMap` (`WeakMap<object, string>` + `Map<string, object>`) matches MUSIC_ENGINE.md §4.1.
- **A:** filled while building; covers every MHD id of all 14 documents (39,842 for the 300 × 8 document). Placeholder voices/beats have no MHD id.
- **B:** recovered by walking MHD and the Score in parallel (track, staff, bar, voice, beat, note indexes, skipping placeholders): 0 unmatched ids in all 14 documents, and every recovered object is equivalent to A's (pitch, string, fret, start tick, duration). It depends on the importer keeping MHD order 1:1 and costs ~15–17 ms extra for the 300 × 8 document.
- **Hit-testing:** every beat in `boundsLookup` maps back to its MHD id (test on `band-repeats`).
- **After rebuild or edit:** a rebuilt Score has new objects and ids; the old map does not know them, a fresh map (A) or a fresh recovery (B) resolves every MHD id again, including newly inserted beats. A positional key (track/staff/bar/voice/beat index) names a different beat after an insert (test), so positional keys must never be cached across edits. With ADR-0002's "fresh Score per change", the map is rebuilt with every Score.

## 8. Benchmark (300 master bars × 8 tracks)

`pnpm bench` (Node with `--expose-gc`): one cold run, then 30 warm runs, A and B alternating. Three complete runs on Node 26.13.1, Intel Core i7-9750H (12 threads), macOS (Darwin 25.6.0), alphaTab 1.9.0. Times in ms; ranges are over the three runs.

| Measurement | Strategy A | Strategy B |
|---|---|---|
| Cold run, conversion to a finished Score | 87 – 201 (build 63 – 176, `finish()` 23 – 26) | 240 – 356 (generate 23 – 27, parse 217 – 329) |
| Warm median: build / generate | 47 – 51 | 11 – 16 |
| Warm median: `finish()` / parse (incl. finish) | 8.8 – 9.4 | 88 – 106 |
| **Warm median: time to finished Score** | **55 – 63** | **105 – 121** |
| Warm mean | 59 – 70 | 112 – 134 |
| Warm p95 | 76 – 118 | 174 – 200 |
| id map (B: positional recovery), warm median | included in build | 14.5 – 17 |
| Warm median including id map | 55 – 63 | 121 – 138 |
| alphaTex size | – | 185,244 characters (MHD JSON: 2,139,953 bytes) |
| alphaTab objects | 300 master bars, 8 tracks, 9 staves, 2,700 bars, 3,000 voices, 14,400 beats, 19,425 notes | same |
| Retained heap after one conversion (gc before/after) | 30.3 MB | 30.9 MB |

The cold A run includes the one-time articulation-table load (an alphaTex parse). Rendering is measured separately and is not part of either conversion: Node SVG, all 8 tracks, width 1300: cold 621 – 714 ms, warm median 397 – 501 ms (4 runs each). The numbers come from Node on a laptop, not from a browser worker; p95 varies noticeably between runs. They compare the strategies; they are not a budget for the editor loop (spike S3).

## 9. Feature support and losses

Severity: **none** · **low** · **medium** · **high** · **unsupported**. "✅" = verified in the finished Score (and MIDI/rendering where relevant), not just accepted.

| MHD feature | Strategy A | Strategy B | Loss / limitation | Workaround | Severity |
|---|---|---|---|---|---|
| Tracks, staves, bars, voices, beats, notes | ✅ (pads voices) | ✅ | – | – | none |
| Durations, dots, tuplets 3:2, 5:4, 2:3, 128ths | ✅ | ✅ | – | – | none |
| Tuplets not representable at PPQ 960 (7:8) | ✅ truncated | ✅ truncated | integer ticks | timeline (S5) must truncate the same way | low |
| Time signature, pickup, triplet feel | ✅ | ✅ | – | – | none |
| Key signature (−7…7, major/minor) | ✅ | ✅ | – | – | none |
| Tempo changes (position, label) | ✅ | ✅ (round-trip decimals) | – | – | none |
| Repeats and repeat count | ✅ | ✅ | – | – | none |
| Alternate endings 1–8 | ✅ | ✅ | – | – | none |
| Alternate endings 9–32 | stored | stored | drawn without numbers | restrict MHD or accept | medium |
| Alternate endings 33–99 | ❌ | ❌ | 32-bit mask | warning (MUSIC_ENGINE.md §4.2) | unsupported |
| Directions (12 kinds), sections | ✅ | ✅ | – | – | none |
| Bar fermata | ✅ placed | ✅ placed | MHD has no position; put on the last beat of track 1 | define position in MHD or keep the convention | low |
| Clef (all five), carried forward, default per instrument | ✅ | ✅ | – | – | none |
| Bar ottava | mapped to clef ottava | same | meaning of the MHD field unclear | owner decision (§12) | medium |
| Staff display (standard, tab, slash, numbered) | ✅ | ✅ | – | – | none |
| Tuning (4–10 strings), capo | ✅ | ✅ | – | – | none |
| Fret count | ❌ | ❌ | no alphaTab field | stays in MHD | low |
| Transposition | ✅ display transposition | ✅ explicit `displaytranspose` | – | – | none |
| Track name, short name | ✅ | ✅ | alphaTab truncates short names to 10 characters | – | low |
| Program, bank, mute, solo | ✅ | ✅ | – | – | none |
| Volume, pan | ✅ quantised | ✅ quantised | 0..16 steps | – | low |
| Track colour token | hex placeholder | hex placeholder | token not representable | style through renderer resources | low |
| MIDI channel assignment | ✅ controlled | ⚠️ importer; melodic secondary on channel 9 | B cannot set channels | none in B | none (A) / medium (B) |
| Pitch (string/fret, MIDI pitch) | ✅ | ✅ | – | – | none |
| Spelling (`step`, `alter`) | ✅ accidental mode | ✅ pitch name + `acc` | – | – | none |
| Chords, rests | ✅ | ✅ | – | – | none |
| Ties (within and across bars, chords) | ✅ | ✅ | – | – | none |
| Grace notes (before / on beat, groups) | ✅ | ✅ | value normalised; time taken from the previous beat | timeline must mirror alphaTab (S5) | low |
| Dynamics | ✅ carried forward | ✅ carried forward | – | – | none |
| Note velocity | ❌ | ❌ | dynamics only | own MIDI scheduler / practice (Phase 2) or map to dynamics | medium |
| Note hand, staff hand | ❌ | ❌ | no hand concept | stays in MHD (visualizer, practice) | low |
| Percussion GM keys | ✅ | ✅ | – | – | none |
| `drumTechnique` choke, edge, rimshot on 38 | ✅ | ✅ | – | – | none |
| `halfOpen` on 42 / 46 | ⚠️ | ⚠️ | one articulation, sounds as GM 46 | accept, or warn on export | medium |
| `rimshot` on 40 | ❌ | ❌ | no articulation | plain 40 + warning | unsupported |
| Sustain pedal (any position, held across bars) | ✅ notation | ✅ notation | no CC 64 in playback | spike S7 | high (playback only) |
| Note effects (bend, slides, hammer, harmonics, trill, accents, dead, ghost, staccato, let ring, palm mute, vibrato, fingering) | ✅ | ✅ | natural-harmonic value derived from the fret; MHD `harmonic.fret` ignored for natural | – | low |
| Left-hand finger 5 | ❌ | ❌ | alphaTab has five fingers, MHD numbering undocumented | owner decision (§12) | low |
| Beat effects (brush, tremolo, pick stroke, tap/slap/pop, fade-in, whammy, crescendo) | ✅ | ✅ (`tbe` for whammy) | – | – | none |
| Text, lyrics (several lines) | ✅ | ✅ | – | – | none |
| Meta (title … notes) | ✅ | ✅ (escaped) | – | – | none |
| `extensions` | not mapped | not mapped | nothing to map in v1 | – | none |
| Stable MHD id ↔ object | ✅ while building | ✅ positional recovery | B relies on 1:1 order | – | none (A) / low (B) |

Both strategies reach the same semantic coverage: every MHD feature that one of them supports, the other supports identically, and every loss is shared because it comes from the alphaTab model itself.

## 10. Known limitations of the spike

- Conversion, MIDI and rendering were measured in Node, not in a browser or the render worker; audible playback was not checked (MIDI events only).
- Firefox, Safari and WebKit were not used in S2 (S1 covers the browser integration).
- Playback order with repeats and endings above 8 was compared A vs B only, not against an independent expectation (timeline: Phase 1 / S5).
- The GP7 files were re-imported with alphaTab, not opened in Guitar Pro.
- Benchmark p95 varies between runs on the laptop; three runs are reported as ranges.
- The generated alphaTex was not checked against alphaTab's `AlphaTexExporter` output beyond using it as a syntax reference.

## 11. Commands

From `spikes/s2-mhd-to-alphatab` (Node 26.13.1; `@musichub/music-model` must be built, e.g. by `pnpm turbo run build --filter=@musichub/music-model`):

```bash
pnpm test        # 142 tests: both strategies on all documents, findings, id map
pnpm compare     # comparison table; results/compare.json and results/<name>.atex
pnpm bench       # 300 × 8 benchmark (BENCH_RUNS, BENCH_RENDER_RUNS)
pnpm render      # results/render/<name>.html + .png; --docs copies canonical screenshots to docs/spikes/
```

From the repository root: `pnpm turbo run lint typecheck test --filter=@musichub/spike-s2-mhd-to-alphatab`.

## 12. Recommendation (decision by the owner)

**Recommendation: Strategy A for `packages/music-engine`, with the Strategy B generator kept as a test oracle.**

Musical semantics do not decide between the two: on all 14 documents both reach identical facts, identical MIDI notes, identical rendered layout, and the same losses. The decision rests on the other criteria:

1. **Control over the model.** A sets MIDI channels, programs and articulations exactly; B cannot express channels and its importer puts melodic tracks on the drum channel in 2 of 14 documents, adds a stray program change, and auto-assigns defaults that B has to override.
2. **ID mapping.** A gets the map for free while building; B needs a positional recovery that only works while the importer keeps MHD order 1:1 and adds ~15 ms per 300 × 8 build.
3. **Editing and the edit loop.** ADR-0002 rebuilds a fresh Score for every change; A is about twice as fast (median 55 – 63 ms vs 105 – 121 ms, plus 15 ms for B's map), which matters for the < 150 ms target of spike S3.
4. **Playback and timeline.** Both produce the same MIDI, so both serve playback; A gives direct access to the objects the timeline (S5) and the playback-score variants (S7) must manipulate.
5. **Scalability.** A's cost is in our own object construction (`finish()` itself is ~9 ms); B's cost is mostly the alphaTex parser.

**Arguments against A (and how to contain them):** A depends on undocumented alphaTab conventions (§2 invariants 1–5: voice padding, drum-tab strings, articulation registration, global id counters), which may change with an alphaTab upgrade, and its errors surface as `TypeError`s inside alphaTab without MHD context. Mitigation: always run `validateDocument` first, and keep this spike's harness (B generator + fact/MIDI/JSON comparison) as a regression test that runs on every alphaTab upgrade.

**Arguments against B:** slower (2× warm, 2.5× cold), no MIDI channel control, grammar pitfalls (§3), error positions in generated text rather than MHD, id map by position only. B is simpler to write and its input is human-readable, which makes it a good oracle and debugging aid, not the production path.

### Open questions for the owner

1. Accept Strategy A for `music-engine` and keep B as a test oracle? Recording the decision in ADR-0002 is a separate task (S2-12 or as decided).
2. **`Bar.ottava`:** clef ottava (current mapping, alphaTab `Bar.clefOttava`) or an 8va/15ma line over the bar (alphaTab `Beat.ottava`)? MHD v1 does not define it.
3. **Bar fermata position:** keep "last beat of track 1" or give the MHD fermata a position (schema change before the first public release)?
4. **Left-hand fingering numbering** (MHD 0..5, undocumented; alphaTab has five fingers).
5. **Alternate endings above 8** (drawn without numbers) and above 32 (impossible): restrict MHD, or keep 99 with a warning?
6. **`halfOpen` on 42 vs 46 and `rimshot` on 40:** keep them in `DRUM_TECHNIQUES` with an engine warning, or narrow the MHD pairs?
7. **Note velocity:** play it through the own MIDI scheduler only, or map it to alphaTab dynamics for playback?
8. **MIDI channel policy** beyond 15 melodic tracks (MHD allows 64 tracks).
9. **Timeline parity (S5):** mirror alphaTab's grace timing and tuplet tick truncation in `music-model/timeline`.
10. **Global alphaTab ids:** build each Score in one place without interleaved imports; relevant for the playback-score variants of S7.
11. **Doc correction:** MUSIC_ENGINE.md §4.2 says endings "above 32" need a warning; rendering already loses numbers above 8. Update the text when the decision is recorded (not changed in this task).
