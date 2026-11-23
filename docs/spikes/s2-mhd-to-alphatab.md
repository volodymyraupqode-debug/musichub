# Spike S2 — MHD v1 → alphaTab: Strategy A (direct model) vs Strategy B (alphaTex)

- **Task:** ROADMAP.md S2-05 (MUSIC_ENGINE.md §4.1 `toAlphaTab()`, §10 spike S2)
- **Code:** `spikes/s2-mhd-to-alphatab` (isolated workspace package, Node only)
- **Status:** **complete.** The owner approved Strategy A with B as a test-only oracle and decided the follow-up questions Q-B to Q-E; the decisions are recorded in [ADR-0002, Amendment 1](../adr/0002-canonical-document-model.md#amendment-1-2026-11-24-alphatab-adapter-strategy-spike-s2-s2-05). Some Q-C points and other questions stay open (§12).
- **Date:** 2026-11-23; revised 2026-11-24 after the review and the Q-D/Q-E follow-up (PR #11)

## 1. Goal and scope

Decide experimentally how the future `packages/music-engine` turns an MHD v1 document into an alphaTab `Score`:

- **Strategy A:** build the alphaTab model objects (`Score`, `MasterBar`, `Track`, `Staff`, `Bar`, `Voice`, `Beat`, `Note`) directly and call `score.finish(settings)` once.
- **Strategy B:** generate alphaTex from MHD and import it with `ScoreLoader.loadAlphaTex` (AlphaTexImporter, which calls `finish()` itself).

Evidence counts only when it is checked in the resulting structure, MIDI output or rendering, never because a converter raised no error. Out of scope: production code, `packages/music-engine`, `apps/web`, and the alphaTab version. MHD v1 changed once after the review, by owner decision (Q-D/Q-E, §2.1).

| Component | Version |
|---|---|
| alphaTab | `@coderline/alphatab` 1.9.0 (pnpm catalog, unchanged) |
| Node.js | 26.13.1 |
| TypeScript / Vitest / Playwright | 6.0.3 / 5.1.1 / catalog version (Chromium for screenshots only) |

### 1.1 Spike structure

`spikes/s2-mhd-to-alphatab` is a separate package (`@musichub/spike-s2-mhd-to-alphatab`). A shared `spikes/engine` package was not created: S2 needs nothing from S1, and S3–S7 are not approved yet, so a shared package would be speculative. The spike depends on `@coderline/alphatab` and `@musichub/music-model` (workspace), plus catalog dev tools; **no new dependency** was added to the catalog. The canonical fixtures are read from `packages/music-model/fixtures/v1` with `fs`. dependency-cruiser and the ESLint spike preset apply unchanged (`pnpm depcruise`: no violations).

**Deviation from the task (documented):** the task asked to use the S1 spike for the visual check, but spikes must not import each other (`no-spike-to-spike`, spikes/README.md). The visual check therefore uses the same alphaTab `ScoreRenderer` headless in Node (SVG engine, MUSIC_ENGINE.md §2.6) and screenshots the SVG in Playwright Chromium with the Bravura font alphaTab ships. S1 stays untouched and its smoke tests still pass.

### 1.2 Files

| File | Purpose |
|---|---|
| `src/strategy-a.ts` | Strategy A converter; builds the `idMap` while constructing |
| `src/strategy-b.ts` | Strategy B: MHD → alphaTex generator + import |
| `src/mapping.ts` | Value mappings **shared by both** (enums, units, channels, percussion articulations, fermata placement) |
| `src/facts.ts` | Comparable facts from an alphaTab `Score` and from MHD (see §5.1 on independence) |
| `src/midi.ts`, `src/render.ts` | MIDI from `MidiFileGenerator`; headless rendering with bounds lookup |
| `src/id-map.ts` | `idMap` and positional recovery for Strategy B |
| `src/losses.ts` | `Loss` records: a partial mapping of the Q-B diagnostic contract (§9.1) |
| `src/synthetic.ts`, `src/performance.ts`, `src/builders.ts` | Synthetic fixtures and the 300 × 8 document |
| `src/*.test.ts` | 4 files, 164 tests + 1 skipped: both strategies on every document, alphaTab findings, id map, fermatas and ottava |
| `scripts/compare.ts`, `bench.ts`, `render.ts` | Reproducible comparison, benchmark, screenshots |

## 2. Strategy A — direct model + `finish()`

Order that works: create all `MasterBar`s and `score.addMasterBar()`; per track `score.addTrack()`, `track.ensureStaveCount(n)`; per staff set display, tuning, capo and transposition, then `staff.addBar()`, `bar.addVoice()`, `voice.addBeat()`, `beat.addNote()`, registering every object in the `idMap` as it is created; attach fermatas with `masterBar.addFermata(tick, …)`; finally **one** `score.finish(settings)`. `finish()` computes beat timing (`playbackStart`, `playbackDuration`, `displayDuration`), chains beats and notes across bars, resolves ties (`tieOrigin`), grace groups, tuplet groups, pedal chains and master-bar start ticks. Every conversion builds a fresh Score with a fresh `idMap`.

Invariants Strategy A must ensure itself (each found by a failure, each pinned by a test or the comparison):

1. **Equal voice count per staff.** `Voice._chain` links voice *i* of a bar to voice *i* of the next bar; a missing voice throws a `TypeError` inside `finish()`. alphaTab's own importers pad with placeholder voices (non-public `ModelUtils.appendPlaceholderVoice`: one `isEmpty` quarter beat). A does the same; an empty MHD voice also gets one placeholder beat.
2. **Time signature, key signature and clef on every bar.** MHD stores only changes; alphaTab needs the value in force on each master bar / bar (A carries them forward). The default clef is derived from the instrument (MUSIC_ENGINE.md §3.3 rule 8).
3. **Percussion staff layout.** The alphaTex importer gives a percussion staff six drum-tab "strings" (tuning `[0,0,0,0,0,0]`) and gives each note the first free string; the model API leaves `string` as `NaN`. A replicates both.
4. **Percussion articulations must be registered in `track.percussionArticulations`.** A raw articulation id renders and plays (alphaTab falls back to its table), but `Gp7Exporter` then writes wrong instruments (re-import gave 49, 68, 64… instead of 46, 46, 42…). The table (`PercussionMapper`) is not public; A reads the articulation objects once from a parsed alphaTex percussion track. **Review finding:** this table omits id 59, so MHD `59 + edge` is still stored as an unregistered raw id (§10.2).
5. **alphaTab element ids are global static counters, and every alphaTex import resets them** (`Score.resetIds`). An import in the middle of an A build gave later bars duplicate ids, and `Gp7Exporter` (which keys bars by `Bar.id`) then mixed up bars: D.S./coda playback of the re-imported file grew from 77 to 403 note-ons. A therefore loads the articulation table before creating any object. Consequence for `music-engine`: never interleave a build with an import, and do not rely on alphaTab ids being unique across two live Scores (pinned by a test).
6. **Units:** MHD `transpositionPitch` maps to `Staff.displayTranspositionPitch` (same sign); `Staff.transpositionPitch` would also shift playback. MHD string 1 (highest) = alphaTab string *n* (alphaTab counts from the lowest). Non-stringed pitch is `octave = ⌊p/12⌋`, `tone = p mod 12`. Brush duration is in ticks for the whole chord. alphaTex's natural-harmonic value is derived from the fret (copied table).

### 2.1 Ottava and fermatas (decisions Q-D and Q-E, PR #11)

Before PR #11 the spike mapped MHD `Bar.ottava` to the clef ottava (`Bar.clefOttava`) and put the MHD bar fermata (`fermata: true`, no position) on the last beat of track 1. Both were placeholders for undefined MHD semantics and are replaced:

- **Ottava.** `Bar.ottava` (`15ma` | `8va` | `8vb` | `15mb`) is a display-only octave line over every beat of every voice of the current bar on that staff, not carried into the next bar. A sets `Beat.ottava` on every MHD beat of the bar, grace beats included; `Bar.clefOttava` stays regular. `Note.pitch` stays the sounding pitch.
- **Fermatas.** `MasterBar.fermatas: { position; type? }[]` replaces `fermata: true`. For each fermata, `fermataPlacement` (shared, `mapping.ts`) converts the reduced fraction of the nominal bar length to ticks in **exact fraction arithmetic**. A fermata is placed (`masterBar.addFermata(tick, …)`, `short` → Short, absent → Medium, `long` → Long) only if the tick is a **whole number** and a **non-grace beat** of some voice of some staff starts **exactly** there. Otherwise it is never rounded or moved: no alphaTab fermata is created and a diagnostic is recorded (§9.1). The MHD document is not changed (test).

## 3. Strategy B — alphaTex + AlphaTexImporter

The generator writes alphaTex 1 (alphaTab 1.9 language) using only syntax confirmed in the parser source and probes: `\track ("name" "short") { color volume balance instrument bank mute solo }`, `\staff { score tabs slash numbered }`, `\tuning`, `\capo`, `\displaytranspose`, `\articulation defaults`, `\voice`, bar metadata (`\ts \ks \clef \tempo (bpm "label" ratio) \ro \rc \ae \tf \section \jump \ac \spd \spu`), beat properties (`d dd tu gr dy txt lyrics v vw tp su sd bu bd tt s p f tbe cre dec fermata instrument ot`) and note properties (`t be ss sl sou sod sib sia h pm lr x g st ac hac nh ah ph th sh fh v vw tr lf rf acc`). Since PR #11 it writes the beat property `ot` for `Bar.ottava` (never `\ottava`, which sets the clef ottava) and writes `fermata (type 0)` on the first non-grace beat in document order (track, staff, voice) that starts exactly at the fermata tick; the importer then registers it on the master bar at that beat's start. Unplaceable fermatas get the same diagnostics as in A.

The ids of a B Score are recovered after import by walking MHD and the Score in parallel (§7).

**B as an oracle.** B is kept only as a test-only regression oracle (ADR-0002, A1). It is **not fully independent of A**: both use the value-mapping tables and helpers in `mapping.ts` (enums, units, percussion articulation ids, default clef, mixer scaling, fermata placement and the exact beat lookup). Agreement between A and B therefore validates how each one builds the alphaTab model, not the mapping decisions themselves.

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
| `piano-grand-staff` | canonical | grand staff, chords, `8va` (bar 2), tempo change with label, pedal |
| `band-repeats` | canonical | 4 tracks, pickup, repeat + endings, segno / To Coda / D.S. al Coda / coda, fermata at `[0, 1]` (bar 7), drum techniques |
| `multi-voice` | synthetic | 4 voices in one bar, changing voice counts, empty secondary voice |
| `multi-instrument` | synthetic | 9 tracks: 7-string guitar, 5-string bass, strings, brass with bank, woodwinds (numbered), vocals with lyrics, synth (slash), drums; mute/solo/pan |
| `rhythm` | synthetic | pickup, 7/8, 5/4, 12/8 + triplet feel, 6/8 duplet, 3:2, 5:4, 7:8 tuplets, double dots, 128ths, tempo at 1/3 and 3/4 |
| `ties-grace` | synthetic | ties within and across bars, chord ties, grace groups of 1–3, on-beat grace |
| `repeats` | synthetic | three-pass repeat with endings [1,2]/[3], second repeat, endings 1–8 / 9–10 / 11–12 |
| `navigation` | synthetic | segno, segnoSegno, toCoda, fine, dalSegnoAlCoda, coda, doubleCoda + positioned fermata, daCapoAlFine |
| `percussion` | synthetic | every valid (GM key, `drumTechnique`) pair and plain keys |
| `pedal` | synthetic | pedal at 1/3, 2/3, 1/8, 7/16, 5/8, held through bars without markers, synth track |
| `long-sequence` | synthetic | 64 bars: 16ths on guitar, 8ths on piano (1,536 notes) |
| `effects` | synthetic | every note and beat effect, spelling, dynamics, velocity, hand, minor/major keys, all clefs and ottavas |
| `fermatas-ottava` | synthetic (PR #11) | standard, short and long fermatas, two in one bar, one where no beat starts, one on a 7:4 beat at a non-integer tick; `8va` on a bar with a grace beat, `15mb`, then no ottava |
| `performance-300x8` | performance | 300 master bars, 8 tracks (9 staves), 14,400 beats, 19,425 notes; benchmark input only |

**Counts:** 3 canonical + 11 synthetic + 1 performance = **15 documents compared**. Rendering checks and screenshots cover the **14** non-performance documents. All 15 pass `validateDocument` with `valid: true`; `fermatas-ottava` has exactly the intended `fermata-not-on-beat` warning, the others have zero issues. (Before PR #11 the counts were 14 compared and 13 rendered.)

## 5. Comparison results

### 5.1 How it was checked

For every document and both strategies (`pnpm compare`, `pnpm test`):

1. The Score builds without error.
2. **Facts vs MHD:** structure, time/key signatures, tempo (bpm, position, label), pickup, repeats, endings, directions, sections, track info, staff display, tuning/capo, transposition, clef and clef ottava, beat ottava, fermatas (tick and type), pedal positions, voices, rhythm in ticks, grace, rests, chords, sounding pitch (`realValueWithoutHarmonic`, string, fret) and ties are extracted from the finished Score and compared with values computed from MHD. **Independence is partial:** structure, pitch, rhythm, ties, grace, rests, repeats, endings, tempo, sections, pedal and percussion sound are computed from MHD alone; clef, ottava, directions, mixer values and fermata placement reuse the tables and helpers in `mapping.ts` and therefore cannot catch a wrong mapping decision.
3. **A vs B:** all fact groups, including dynamics, accidental mode, text/lyrics, every beat and note effect, percussion articulation id and drum-tab string. Effects are compared only A vs B; B uses its own alphaTex tags, so this does cross-check the effect mapping.
4. **Full model diff:** `JsonConverter.scoreToJsObject` of A and B compared field by field (alphaTab id references excluded). This was run with scripts during the spike and its review; it is **not** part of the committed tests (a Phase 1 requirement, §10.3).
5. **MIDI:** `MidiFileGenerator` output of A and B (note on/off with tick, key, velocity; tempo; program and control changes).
6. **Rendering:** `ScoreRenderer` in Node; rendered master bars, bar bounds, distinct beats and notes with bounds compared with MHD counts (tests); beat bounds of A and B compared (script, review); screenshots (§6).
7. **Guitar Pro 7 export:** export, re-import, compare MIDI notes with the original (tests).

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
| fermatas-ottava | ok | ok | yes | rhythm (grace, 7:4 ticks) | 27, yes | 7 / 27 / 27 | 77 / 77 |
| performance-300x8 | ok | ok | yes | percussion (halfOpen) | 29,267, yes | not rendered in tests | 39,842 / 39,842 |

"Rendered bars" counts one bar bound per drawn notation line (notation + tab = 2). Every expected beat and note has rendered bounds in both strategies.

**Full model diff (JsonConverter), A vs B** (scripts; rerun on all 15 documents after PR #11): identical except for (a) alphaTab id references (`tieOriginNoteId` etc., global counters), (b) MIDI channel numbers on documents with a drum track (§5.4), (c) B♯3 / E𝄫4 stored as `octave 4 / tone 12` (B, from the pitch name) vs `octave 5 / tone 0` (A) with the same sounding pitch, accidental mode and rendering, and (d) **in `percussion`, A does not register articulation id 59** (MHD `59 + edge`) in `track.percussionArticulations` and stores the raw id instead, while B registers it. The fact-based tests did not catch (d); only the full model diff did.

**MIDI:** note on/off, tempo and velocity events are identical for all 15 documents. Strict comparison (with channels and program changes) differs only on the three documents with a drum track (§5.4). alphaTab generates **no sustain-pedal (CC 64) events** and **no fermata holds** for either strategy (tests for the pedal; fermata checked by script: same last note-off tick with and without a fermata).

**GP7 round trip:** re-imported MIDI notes equal the original for 14 of 15 documents with both strategies; in `effects` the trill playback changes (4 note-on differences, the same for A and B). Placed fermatas and ottava survive the round trip. Input for spike S4, not a conversion difference.

### 5.3 Deviations shared by both strategies (alphaTab semantics)

| Finding | Evidence |
|---|---|
| A grace beat's value is normalised by group size (1 → eighth, 2 → 16th, ≥ 3 → 32nd); its playback length is fixed (120 ticks for one grace); a before-beat grace takes that time from the **previous** beat (guitar bar 2 rest: 960 → 840 ticks) | `findings.test.ts`, `Beat.finish/updateDurations` |
| Tuplet ticks PPQ 960 cannot represent are truncated (7:8 sixteenth: 274 instead of 274.29; 7:4 quarter: 548 instead of 548.57) | `findings.test.ts`, `fermatas-ottava` |
| Half-open hi-hat is one articulation (92) that sounds as GM 46 (open hi-hat): MHD 42 + halfOpen and 46 + halfOpen collapse | `findings.test.ts` |
| No rimshot articulation for GM 40 (electric snare): played and drawn as plain 40 | `findings.test.ts` |
| Alternate endings 9–32 are stored in the bitmask but drawn without numbers (`MasterBar.MaxAlternateEndings` = 8) | `findings.test.ts`, screenshot `repeats` |
| No CC 64 for the sustain pedal | `findings.test.ts` |
| Fermatas and ottava do not change MIDI playback (ottava: display only; fermata: no hold) | `fermata-ottava.test.ts` (ottava), script (fermata) |
| A fermata is drawn only on a beat that starts exactly at its tick (`MasterBar.getFermata` matches `playbackStart`) | alphaTab source, `fermata-ottava.test.ts` |

### 5.4 Differences between the strategies

| Topic | Strategy A | Strategy B |
|---|---|---|
| MIDI channels | Chosen by the spike adapter: consecutive pairs while they fit, melodic tracks kept off channel 9 up to 15 melodic tracks; primaries first when pairs do not fit; beyond 15 melodic tracks channels are reused by track index **without a diagnostic**, and a 25-track probe gave the 25th melodic track channel 9 (not the approved policy, §10.2) | Assigned by the importer; it reserves a pair for the percussion track and **puts a melodic track's secondary channel on 9** (drum channel) in `multi-instrument` and `performance-300x8` |
| Drum program change | 0 | 25 unless `instrument 0` is added (pitfall 6) |
| GP7 export of percussion | correct only with registered articulations (invariant 4) | correct |
| Alternate endings 33+ | **silently corrupted**: `1 << 32` wraps to 1, so ending 33 becomes ending 1 | rejected by the importer (`AT211`) |
| ID mapping | recorded while building | positional recovery after import (§7) |
| Invalid input (validation bypassed) | string out of range, overfull and missing bars accepted silently; some inconsistencies crash inside alphaTab (`TypeError`) without element context | string out of range rejected with a diagnostic (line and column of the generated text); overfull and missing bars accepted silently |
| Unplaceable fermata | `unsupported` diagnostic, no alphaTab fermata | identical diagnostic (test) |
| Coupling | to undocumented model conventions (§2 invariants 1–5) | to the alphaTex grammar and importer behaviour (§3) |

## 6. Visual check

`pnpm render` renders A above B for every document into `results/render/<name>.html` and PNG (git-ignored); the canonical screenshots are committed:

- [guitar-basic](s2-mhd-to-alphatab/guitar-basic.png) — notation + tab, hammer-on, bend, brush chord, triplets, palm mute, slide, grace, vibrato, harmonic, second voice (grey), tie.
- [piano-grand-staff](s2-mhd-to-alphatab/piano-grand-staff.png) — grand staff with brace, chords, two voices, `rit.` tempo change, pedal marks, tie, and the `8va` line over bar 2 only (regenerated after PR #11; the earlier image showed the replaced clef-ottava mapping).
- [band-repeats](s2-mhd-to-alphatab/band-repeats.png) — 4 tracks, pickup, repeat, endings 1./2., segno, To Coda, D.S. al Coda, coda, fermata on the first beat of bar 7 in every track, drum noteheads, alphaTab attribution.

A and B look the same in all 14 screenshots; no notes, voices, tracks or bars are missing, the grand staff stays one track with two staves, repeats and endings are drawn. Beat bounds of A and B are identical in all 14 rendered documents (script). The SVG text of A and B is not byte-identical (one path group in `band-repeats` differs in geometry; all drawn texts and beat bounds are equal); no visible difference was found. A correct rendering is not taken as proof of semantic equality; §5 is the evidence.

## 7. ID mapping

- alphaTab ids (`Bar.id`, `Voice.id`, `Beat.id`, `Note.id`) are **global static counters**: different for every new Score, reset by every alphaTex import, and therefore unusable as keys (tests). There is no free field on the model for a foreign id.
- A separate map is required. The spike's `idMap` (`WeakMap<object, string>` + `Map<string, object>`) matches MUSIC_ENGINE.md §4.1. It belongs to one Score and is never reused for another.
- **A:** filled while building; covers every MHD id of all 15 documents (39,842 for the 300 × 8 document). Placeholder voices/beats have no MHD id.
- **B:** recovered by walking MHD and the Score in parallel (track, staff, bar, voice, beat, note indexes, skipping placeholders): 0 unmatched ids in all 15 documents, and every recovered object is equivalent to A's (pitch, string, fret, start tick, duration). It depends on the importer keeping MHD order 1:1 and costs ~15–17 ms extra for the 300 × 8 document.
- **Hit-testing:** every beat in `boundsLookup` maps back to its MHD id (test on `band-repeats`).
- **After rebuild or edit:** a rebuilt Score has new objects and ids; the old map does not know them, a fresh map (A) or a fresh recovery (B) resolves every MHD id again, including newly inserted beats. A positional key (track/staff/bar/voice/beat index) names a different beat after an insert (test), so positional keys must never be cached across edits.
- Elements without their own MHD id (individual fermatas) can only be identified through their master bar and position.

## 8. Benchmark (300 master bars × 8 tracks)

`pnpm bench` (Node with `--expose-gc`): one cold run, then 30 warm runs, A and B alternating. Three complete runs on Node 26.13.1, Intel Core i7-9750H (12 threads), macOS (Darwin 25.6.0), alphaTab 1.9.0, measured on 2026-11-23 before PR #11 (the performance document has no fermatas or ottava, so the change does not apply to it). Times in ms; **ranges are the minimum and maximum over the three runs, not confidence intervals.**

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
| Retained heap after one conversion (gc before/after, single sample) | 30.3 MB | 30.9 MB |

Statistics notes (review): "median" is the lower median (15th of 30 values) and p95 is nearest-rank (29th of 30), which is a weak estimate at n = 30. B's cold run follows A's cold run in the same process and is therefore not fully cold; A's cold run includes the one-time articulation-table load (an alphaTex parse). The raw outputs of the three runs were not stored. A review rerun on 2026-11-23 stayed inside the ranges (warm median A 57.9 ms, B 111.5 ms, B with id map 128.5 ms).

Rendering is measured separately and is not part of either conversion: Node SVG, all 8 tracks, width 1300: cold 621 – 714 ms, warm median 397 – 501 ms (4 runs each). The numbers come from Node on a laptop, not from a browser worker. They compare the strategies; they are not a budget for the editor loop (spike S3).

## 9. Feature support and losses

Severity: **none** · **low** · **medium** · **high** · **unsupported**. "✅" = verified in the finished Score (and MIDI/rendering where relevant), not just accepted.

| MHD feature | Strategy A | Strategy B | Loss / limitation | Workaround | Severity |
|---|---|---|---|---|---|
| Tracks, staves, bars, voices, beats, notes | ✅ (pads voices) | ✅ | – | – | none |
| Durations, dots, tuplets 3:2, 5:4, 2:3, 128ths | ✅ | ✅ | – | – | none |
| Tuplets not representable at PPQ 960 (7:8, 7:4) | ✅ truncated | ✅ truncated | integer ticks | timeline (S5) must truncate the same way | low |
| Time signature, pickup, triplet feel | ✅ | ✅ | – | – | none |
| Key signature (−7…7, major/minor) | ✅ | ✅ | – | – | none |
| Tempo changes (position, label) | ✅ | ✅ (round-trip decimals) | – | – | none |
| Repeats and repeat count | ✅ | ✅ | – | – | none |
| Alternate endings 1–8 | ✅ | ✅ | – | – | none |
| Alternate endings 9–32 | stored | stored | drawn without numbers | adapter diagnostic (Phase 1); MHD keeps 1–99 | medium |
| Alternate endings 33–99 | ❌ silently corrupted | ❌ rejected by the importer | 32-bit mask | report, never truncate or corrupt (Phase 1) | unsupported |
| Directions (12 kinds), sections | ✅ | ✅ | – | – | none |
| Fermatas on a beat start at a whole tick | ✅ exact tick, type | ✅ exact tick, type | no playback hold in alphaTab (timeline owns it) | – | none (notation) |
| Fermatas off a beat start or at a non-integer tick | not placed, `unsupported` diagnostic | same | alphaTab cannot draw or store them at that position | MHD position preserved | unsupported |
| Clef (all five), carried forward, default per instrument | ✅ | ✅ | – | – | none |
| Bar ottava (octave line, bar only) | ✅ `Beat.ottava` | ✅ `ot` | display only, MIDI unchanged | – | none |
| Ottava on percussion or without standard notation | set, not shown | set, not shown | validator warning only; no adapter diagnostic | propagate warning (Phase 1) | low |
| Staff display (standard, tab, slash, numbered) | ✅ | ✅ | – | – | none |
| Tuning (4–10 strings), capo | ✅ | ✅ | – | – | none |
| Fret count | ❌ | ❌ | no alphaTab field | stays in MHD | low |
| Transposition | ✅ display transposition | ✅ explicit `displaytranspose` | – | – | none |
| Track name, short name | ✅ | ✅ | alphaTab truncates short names to 10 characters | – | low |
| Program, bank, mute, solo | ✅ | ✅ | – | – | none |
| Volume, pan | ✅ quantised | ✅ quantised | 0..16 steps | – | low |
| Track colour token | hex placeholder | hex placeholder | token not representable | style through renderer resources | low |
| MIDI channel assignment | ⚠️ controlled, approved fallback not implemented | ⚠️ importer; melodic secondary on channel 9 | B cannot set channels | approved policy in Phase 1 (ADR-0002 A5) | low (A) / medium (B) |
| Pitch (string/fret, MIDI pitch) | ✅ | ✅ | – | – | none |
| Spelling (`step`, `alter`) | ✅ accidental mode | ✅ pitch name + `acc` | – | – | none |
| Chords, rests | ✅ | ✅ | – | – | none |
| Ties (within and across bars, chords) | ✅ | ✅ | – | – | none |
| Grace notes (before / on beat, groups) | ✅ | ✅ | value normalised; time taken from the previous beat | timeline must mirror alphaTab (S5) | low |
| Dynamics | ✅ carried forward | ✅ carried forward | – | – | none |
| Note velocity | ❌ | ❌ | dynamics only | own MIDI scheduler / practice (Phase 2) or map to dynamics | medium |
| Note hand, staff hand | ❌ | ❌ | no hand concept | stays in MHD (visualizer, practice) | low |
| Percussion GM keys | ✅ | ✅ | – | – | none |
| `drumTechnique` choke, rimshot on 38, edge on 51 | ✅ | ✅ | – | – | none |
| `edge` on 59 | ⚠️ unregistered raw id 59 | ✅ | renders and exports through the fallback; model differs | register id 59 (Phase 1 regression test) | low |
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

Both strategies reach the same semantic coverage except where §5.4 lists a difference (MIDI channels, endings 33+, articulation 59 registration); every other loss is shared because it comes from the alphaTab model itself.

### 9.1 Diagnostics in the spike

Each strategy returns `losses: Loss[]` with `feature` (schema-level MHD path), `id` (one MHD id) and `detail`. This is **only a partial mapping of the Q-B contract** (ADR-0002, A2): there is a single `id` instead of `mhdIds`, and `code`, `severity` and `aspect` are optional. Only the fermata checks set them:

| Case | `code` | `severity` / `aspect` | `id` | `detail` (example) |
|---|---|---|---|---|
| No non-grace beat starts at the fermata tick | `unsupported` | warning / notation | the master bar | "no beat starts at fermata [1, 8] (tick 480); alphaTab cannot draw it, not placed" |
| Position is not a whole alphaTab tick | `unsupported` | warning / notation | the master bar | "fermata at [1, 7] is not a whole alphaTab tick; not placed" |

Strategies A and B return identical fermata diagnostics (test). Two failing fermatas in one bar carry the same master-bar id and differ only in `detail`. An unplaced fermata is also missing from GP7 and alphaTex exports, which a single `aspect` value cannot express. The other losses (velocity, hand, fret count, percussion, fingering, staff hand) carry no code yet.

## 10. Review findings and classification

### 10.1 Verified behaviour

- Both strategies convert all 15 documents; facts, MIDI note events and rendered layout of A and B agree (§5).
- Ottava maps to `Beat.ottava`, applies to the bar only, is display-only, and leaves MIDI note events unchanged (`fermata-ottava.test.ts`).
- Fermatas are placed only at an exact whole tick on an exact non-grace beat start; otherwise `unsupported` is reported, nothing is rounded or moved, and MHD is unchanged; A and B diagnostics are identical (`fermata-ottava.test.ts`).
- alphaTab ids are global counters reset by alphaTex imports; the id map is per Score (tests).

### 10.2 Known limitations

1. **Articulation id 59 not registered in Strategy A** (`59 + edge`): the raw-id fallback still renders and survives the GP7 round trip, but the registration defect is real and was found only by the full model diff.
2. **Alternate endings 33+ are silently corrupted by Strategy A** (32-bit shift: ending 33 → ending 1); Strategy B rejects them. MHD still allows endings 1–99.
3. **alphaTab's MIDI generator does not implement fermata holds** (nor sustain-pedal CC 64).
4. **Both strategies accept structurally invalid input silently** (overfull or missing bars; A also strings out of range) when `validateDocument` is bypassed.
5. **Strategy B is not a fully independent oracle**: it shares mapping tables and helpers with A (§3).
6. **Strategy A depends on undocumented alphaTab construction conventions** (§2 invariants 1–5), which may change with alphaTab upgrades.
7. **The spike `Loss` is not the complete Q-B diagnostic contract** (§9.1).
8. **The approved MIDI channel policy is not implemented or verified**: beyond 15 melodic tracks the spike reuses channels by index without an `engine-policy` diagnostic and can even give a melodic track channel 9 (25th track in a probe), and Strategy B cannot control channels at all.
9. Measurement scope: Node only (no browser worker), no audible playback check, GP7 files not opened in Guitar Pro, playback order with endings above 8 compared only A vs B, benchmark p95 noisy (§8).

### 10.3 Phase 1 implementation requirements

- Implement Strategy A in `packages/music-engine` behind the `validateDocument` gate, returning Score + id map + diagnostics on success and diagnostics only on failure.
- Complete diagnostic contract: required `code`, `severity`, `aspect` at every emission site; `mhdIds`; a structured location for elements without their own id; validation warnings propagated; multi-output impact.
- Regression suite on every alphaTab upgrade, including a full serialized-model comparison with the B oracle (re-implemented as test support), and explicit tests for articulation id 59 and alternate endings 33+ (report, never corrupt).
- The approved channel policy (ADR-0002 A5) with `engine-policy` diagnostics.
- Browser-worker rendering, audible playback, third-party opening of GP7 and MIDI exports, and timeline parity (S5).

### 10.4 Unresolved owner decisions

- Q-C details: melodic tracks beyond the available channels; secondary channels first for bend/whammy/vibrato tracks; several percussion tracks with different mixer settings; whether mute/solo changes the allocation; the channel policy of the future MIDI output engine.
- Left-hand fingering numbering (MHD 0..5, undocumented).
- Alternate endings above 8: how the UI and exports should treat numbers alphaTab cannot draw (MHD keeps 1–99).
- Half-open hi-hat on GM 42 vs 46 and rimshot on GM 40.
- Note velocity in alphaTab playback (own scheduler only, or mapped to dynamics).

## 11. Commands

From `spikes/s2-mhd-to-alphatab` (Node 26.13.1; `@musichub/music-model` must be built, e.g. by `pnpm turbo run build --filter=@musichub/music-model`):

```bash
pnpm test        # 164 tests + 1 skipped: both strategies on all documents, findings, id map, fermatas and ottava
pnpm compare     # comparison table; results/compare.json and results/<name>.atex
pnpm bench       # 300 × 8 benchmark (BENCH_RUNS, BENCH_RENDER_RUNS)
pnpm render      # results/render/<name>.html + .png; --docs copies canonical screenshots to docs/spikes/
```

From the repository root: `pnpm turbo run lint typecheck test --filter=@musichub/spike-s2-mhd-to-alphatab`.

## 12. Recommendation and decisions

**Recommendation (S2-05): Strategy A for `packages/music-engine`, with the Strategy B generator kept as a test oracle. The owner approved it (Q-A); see ADR-0002, Amendment 1.**

Musical semantics did not decide between the two: on every document both reach identical facts, identical MIDI notes, identical rendered layout, and the same alphaTab losses. The decision rests on the other criteria:

1. **Control over the model.** A sets MIDI channels, programs and articulations exactly; B cannot express channels and its importer puts melodic tracks on the drum channel in 2 documents, adds a stray program change, and auto-assigns defaults that B has to override.
2. **ID mapping.** A gets the map for free while building; B needs a positional recovery that only works while the importer keeps MHD order 1:1 and adds ~15 ms per 300 × 8 build.
3. **Editing and the edit loop.** ADR-0002 rebuilds a fresh Score for every change; A is about twice as fast (median 55 – 63 ms vs 105 – 121 ms, plus 15 ms for B's map), which matters for the < 150 ms target of spike S3.
4. **Playback and timeline.** Both produce the same MIDI notes; A gives direct access to the objects the timeline (S5) and the playback-score variants (S7) must manipulate.
5. **Scalability.** A's cost is in our own object construction (`finish()` itself is ~9 ms); B's cost is mostly the alphaTex parser.

**Arguments against A (and how to contain them):** A depends on undocumented alphaTab conventions (§2 invariants 1–5), which may change with an alphaTab upgrade; its errors surface as `TypeError`s inside alphaTab without MHD context; and it has two known defects (§10.2, items 1 and 2). Mitigation: always run `validateDocument` first, keep the B oracle with a full model comparison as a regression suite on every alphaTab upgrade, and cover both defects with tests in Phase 1.

**Arguments against B:** slower (2× warm, 2.5× cold), no MIDI channel control, grammar pitfalls (§3), error positions in generated text rather than MHD, id map by position only. B is simpler to write and its input is human-readable, which makes it a good oracle and debugging aid, not the production path.

### Decisions taken after the review

| Question | Decision |
|---|---|
| Q-A: strategy | Strategy A for `music-engine`; B as a test-only regression oracle, re-implemented in Phase 1 test support, with a full serialized-model comparison |
| Q-B: diagnostics | `validateDocument` gate; success = Score + id map + diagnostics, failure = diagnostics only; every loss reported; MHD never rewritten; contract details in Phase 1 |
| Q-C: channels | Approved in part: channel 9 for percussion only, own channel per melodic instrument when possible, no program conflicts from accidental sharing, deterministic fallback with `engine-policy` diagnostic, not part of MHD. Details open (§10.4) |
| Q-D: `Bar.ottava` | Display-only octave line over the current bar, mapped to `Beat.ottava` (PR #11) |
| Q-E: fermatas | Positioned `MasterBar.fermatas` with optional `short` / `long` type; playback owned by the timeline (PR #11) |
| Timeline parity | Mirror alphaTab's grace timing and tuplet tick truncation in `music-model/timeline` (spike S5) |
| Global alphaTab ids | Build each Score without interleaved imports; ids never used as keys (ADR-0002 A1) |

Still open: see §10.4. MUSIC_ENGINE.md §4.2 still says that endings "above 32" need a warning; the review showed that rendering already loses the numbers above 8 and that a naive 32-bit mask corrupts endings 33+. That text is not changed here.
