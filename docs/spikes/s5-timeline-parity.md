# Spike S5 — Timeline parity with alphaTab's MIDI generation

- **Task:** ROADMAP.md S2-06 (MUSIC_ENGINE.md §3.5–3.6 risk R6, §10 spike S5)
- **Code:** `spikes/s2-mhd-to-alphatab/src/timeline/` (inside the S2 spike package, see §2)
- **Status:** **complete for the supported constructs; two semantic divergences need owner decisions** (§7). Phase 1 not started.
- **Date:** 2026-11-24

## 1. Goal and scope

MUSIC_ENGINE.md §3.6 requires the future `music-model/timeline` to "match alphaTab's MIDI generation exactly, otherwise visuals and audio diverge" (risk R6), and §10 sets the pass criterion for spike S5: **100 % note-on parity on fixtures** for repeats, endings, D.S./coda, ties and grace notes.

This spike builds an independent prototype that computes playback order and MIDI events from MHD, and compares it event by event with alphaTab 1.9.0. It is a spike, not the production timeline or Playback Engine. Out of scope: Phase 1, changes to MHD, the S2-05 channel policy, S6 (clock) and S4 (import fidelity).

## 2. Architecture

| Side | Source of truth | Code |
|---|---|---|
| **Reference** | alphaTab 1.9.0 `MidiFileGenerator` on the **Playback Score** built by Strategy A (S2-05), `AlphaSynthMidiFileHandler` | `reference.ts` |
| **Prototype** | MHD only, plus the adapter's channel plan (`allocateChannels`, adapter policy from S2-05) | `playback-order.ts`, `prototype.ts` |
| **Comparison** | Event-by-event classification | `compare.ts` |
| **Golden scenarios** | 19 small original MHD documents | `scenarios.ts`, `timeline.test.ts` (+ `__snapshots__`) |

**Independence.** The prototype never imports alphaTab and never reads alphaTab output; a test checks the imports of `playback-order.ts` and `prototype.ts`. The only shared input is the channel plan, which is adapter policy, not MIDI output.

**Why inside the S2 package.** The reference needs the S2 adapter (Strategy A and the Playback Score), and spikes may not import each other (`no-spike-to-spike`). A separate package would have had to copy the adapter. The timeline code lives in its own folder.

**Sources of the prototype's rules.** Every rule in the code carries a label:

- **[MHD]** rules defined by MUSIC_ENGINE.md §3.2–3.3 and the music-model README: repeat count = total plays; endings play in the passes they list; a repeat end without a repeat start repeats "from the start of the piece or the previous repeat end"; D.C. jumps to the start, D.S. to the segno, "al Fine" stops at Fine, "al Coda" goes to the coda at To Coda.
- **[AT]** alphaTab-parity rules taken from the alphaTab 1.9.0 source, as R6 requires. They cover what MHD leaves to the engine:
  - beat ticks: integer `valueToTicks`, dots and tuplets with truncation;
  - grace timing: 120 / 60 / 30 ticks for groups of 1 / 2 / ≥ 3; before-beat graces take time from the previous beat, also across the bar line; on-beat graces delay the main beat;
  - a lone whole rest fills the bar; the pickup bar length is its longest voice;
  - the global tick shift for a negative first start (tempo events of the first bar are written before the shift);
  - velocity = 15 + 16 × dynamic, ± 16 for accent, ghost and hammer-on destination;
  - the secondary channel for bend, whammy and beat vibrato;
  - tie length up to the end of the tie chain; staccato = half;
  - tempo events per played bar occurrence.
- **[CONV]** notation conventions that MHD does not spell out. The prototype uses them and they match alphaTab, but they need owner confirmation (§7):
  1. after a D.C./D.S. jump, repeats play only their final pass;
  2. a jump inside a repeated section is taken on its last pass only;
  3. To Coda and Fine are ignored before the jump;
  4. D.S. uses the nearest segno before the jump (then after it); To Coda uses the first coda after it.
- **Adapter convention:** a staff's dynamic starts at *f* and is carried through bars and voices in document order (Strategy A); MHD does not define the default.

**Modelled constructs:** notes, chords, rests, ties, grace notes, tuplets, dots, pickup, repeats, endings, all MHD directions, tempo changes, percussion (GM key), multiple tracks and voices, accents, ghost notes, hammer-on velocity, bend/whammy/vibrato channel, staccato.

**Flagged as unsupported** (the prototype emits the note but marks it, and the comparison classifies every event of it as `unsupported`, also when it happens to match the reference; such events are no evidence of parity and are left out of the parity denominator):

| Effect on | Constructs |
|---|---|
| Note-on | harmonics (sounding pitch), trill, tremolo picking, brush (start offsets), legato slide targets, triplet feel |
| Note-off only | dead note, palm mute and let ring lengths (time-based), slide lengths |

## 3. Comparison method

Events compared: **note-on, note-off and tempo**, with type, absolute tick, MIDI channel, key, velocity and MHD track id. The track id is mapped through the Playback Score track order, which equals the order of the playable MHD tracks. Program and control changes, pitch bends and time signatures are not compared.

Classification order per event type (`compare.ts`); each step sees only what earlier steps left:

1. **exact:** same track, tick, key, channel and velocity;
2. **channel / velocity mismatch:** same track, tick and key;
3. **ordering mismatch:** per track, the remaining ticks and keys are equal as multisets but paired differently;
4. **pitch mismatch:** same track and tick, different key;
5. **timing mismatch:** same track and key, nearest tick;
6. **missing** (reference only) / **extra** (prototype only);
7. **unsupported:** the prototype flagged the note's construct (this overrides every step above, including an exact match), or a leftover reference note lies within 960 ticks of a flagged note in the same track.

**No normalisation** besides the track-id mapping: ticks, keys, channels and velocities are compared as integers. Tempo is compared by tick and bpm, rounded to 10⁻⁶. Each category has a unit test.

**Note-on parity** = exact note-ons / comparable reference note-ons (all except `unsupported` and `extra`).

## 4. Golden scenarios

All are original synthetic MHD v1 documents, valid with zero errors. In the main track, bar *i* plays pitch 60 + *i*, so the playback order can be read from the MIDI. `expectedOrder` was derived by hand from MHD semantics. The reference MIDI of every scenario is stored as a Vitest snapshot (`timeline/__snapshots__/timeline.test.ts.snap`), so a change in alphaTab's output fails a test.

| Scenario | Construct | Expected order |
|---|---|---|
| `sequential` | 4 bars, piano + bass (string/fret) | 0 1 2 3 |
| `repeat` | \|: 1 2 :\| 3, then \|: 4 :\| ×3 | 0 1 2 1 2 3 4 4 4 5 |
| `repeat-without-start` | 0 1 :\| 2 | 0 1 0 1 2 |
| `repeat-end-after-repeat` | \|: 1 2 :\| 3 4 :\| | 0 1 2 1 2 3 4 3 4 5 (MHD) |
| `volta` | endings [1,2] / [3], 3 passes | 0 1 2 1 2 1 3 4 |
| `volta-multibar` | two-bar first ending | 0 1 2 3 1 4 5 |
| `dal-segno` | D.S. | 0 1 2 3 1 2 3 4 |
| `da-capo` | D.C. | 0 1 2 0 1 2 3 |
| `da-capo-al-fine` | D.C. al Fine | 0 1 2 3 0 1 |
| `coda` | D.S. al Coda + To Coda + Coda | 0 1 2 3 1 2 4 5 |
| `da-capo-al-coda` | D.C. al Coda | 0 1 2 0 1 3 |
| `segno-with-repeat` | D.S. al Fine back into a repeat | 0 1 2 1 2 3 1 2 |
| `jump-inside-repeat` | D.C. on a repeat's closing bar | 0 1 2 1 2 0 1 2 3 |
| `segno-segno-double-coda` | segnoSegno and doubleCoda markers | 0 1 2 3 4 |
| `ties` | within a bar, across bars, chord ties, tie into a repeated bar | 0 1 2 1 2 3 |
| `grace` | before-beat at the start (tick shift), groups of 1–3, on-beat, grace at a repeat start | 0 1 2 1 2 3 |
| `combined` | pickup, repeat + endings, tempo change, tie, grace, D.S. al Coda, fermata, drum track | 0 1 2 1 3 4 1 3 5 |
| `fermata-ottava` | fermata at 1/2, 8va bar | 0 1 |
| `ending-closing-skipped` | endings [2,3] after a closing bar that has ending [1] | undefined (§7) |

The S2-05 corpus (15 documents, 31,246 reference note-ons) is compared as well.

## 5. Results

### 5.1 Golden scenarios

| Scenario | Note-on | Note-off | Tempo | Order |
|---|---|---|---|---|
| 17 supported scenarios (all except the two below) | **100 % exact** (183 note-ons) | 100 % exact | 100 % exact | prototype and alphaTab = expected |
| `repeat-end-after-repeat` | 7 exact, 3 pitch, 4 missing (of 14) | same | exact | **divergence** (§7, D1) |
| `ending-closing-skipped` | 4 exact, 2 pitch, 1 missing (of 7) | same | exact | **undefined in MHD** (§7, D2) |

### 5.2 S2-05 corpus

| Document | Note-on | Note-off | Unsupported constructs |
|---|---|---|---|
| guitar-basic | 11 exact, 6 unsupported | 8 exact, 9 unsupported | brush, harmonic, palm mute and slide lengths |
| piano-grand-staff, multi-voice, multi-instrument, ties-grace, navigation, pedal, long-sequence, fermatas-ottava | **all exact** (1,721 note-ons) | all exact | – |
| band-repeats | 76 exact, 1 pitch | same | – |
| percussion | 33 exact, 1 pitch | same | – |
| performance-300x8 | 28,815 exact, 452 pitch | same | – |
| repeats | 27 exact, 2 pitch, 4 missing | same | – (contains D2) |
| rhythm | 41 exact, 6 unsupported | same | triplet feel |
| effects | 24 exact, 26 unsupported | 21 exact, 29 unsupported | harmonic, trill, tremolo, brush, legato slide, dead note, let ring, slide lengths |

### 5.3 Totals by category (note-on)

| Category | Golden scenarios | S2 corpus | Explanation |
|---|---|---|---|
| exact | 194 | 30,748 | |
| pitch | 5 | 456 | 454 = half-open hi-hat (§6); 2 + 5 = D1/D2 order differences seen as pitch |
| missing | 5 | 4 | D1/D2 order differences |
| timing, ordering, velocity, channel, extra | 0 | 0 | |
| unsupported | 0 | 38 | every event of the constructs listed in §2, also those that happen to match |

Tick, velocity and channel matched for every compared note: no timing, velocity or channel mismatch occurred.

## 6. Differences and their causes

| # | Fixture | Expected (MHD) | alphaTab | Type | Cause | Fixable now? | Needs |
|---|---|---|---|---|---|---|---|
| 1 | band-repeats, percussion, performance (454 notes) | key 42 (MHD GM key, 42 + halfOpen) | key 46 | pitch | alphaTab has one half-open articulation (92) that sounds as GM 46 (S2-05 finding) | yes, by deciding which key the timeline reports | owner decision: report the MHD GM key (practice/visualizer) or alphaTab's sounding key (parity) |
| 2 | `repeat-end-after-repeat` (D1) | 0 1 2 1 2 3 4 3 4 5 | 0 1 2 1 2 3 4 1 2 1 2 3 4 5 | missing / pitch (order) | alphaTab keeps one repeat group from bar 1; the second closing jumps back to the group opening and resets the first closing's passes. MHD says "from the previous repeat end" | not without changing one side | owner decision: change the MHD rule, reject the pattern in `validateDocument`, or make the adapter restructure the repeat for alphaTab |
| 3 | `ending-closing-skipped` / S2 `repeats` (D2) | undefined | 0 1 2 1 1 3 4 | missing / pitch (order) | MHD does not define whether a repeat end that is skipped in a pass (it carries an ending not in that pass) still repeats. alphaTab does (`Repeat.onClosing` on the last closing) | no: semantics undefined | owner decision on the MHD rule, or a validation rule that every pass of an ending group is closed |

`segnoSegno` and `doubleCoda` caused no difference: in MHD v1 they are only markers, because no MHD direction jumps to them. alphaTab could jump to them (`dalSegnoSegno*`, `*AlDoubleCoda`), but MHD v1 has no such directions.

Fermatas and ottava caused no difference: alphaTab's MIDI ignores both, and the prototype models neither as a playback change. Fermata playback length remains a timeline policy (ADR-0002 A4) that is not defined yet.

## 7. Limitations and open questions

**Decisions needed** (none is assumed here):

1. **D1:** semantics of a repeat end without its own repeat start after an earlier repeat. MHD and alphaTab disagree.
2. **D2:** whether a repeat end in a bar skipped by its ending still repeats. Today this is valid MHD with undefined meaning.
3. The **[CONV]** rules of §2 (repeats after a jump, jumps inside repeats, To Coda/Fine before the jump, which segno or coda when there are several). They match alphaTab but are not written in MHD.
4. **Percussion key** in the timeline: MHD GM key vs alphaTab's sounding key (half-open hi-hat).
5. **Default dynamic:** MHD does not define the dynamic before the first marking; the spike uses the adapter's *f*.

**Not covered:**
- The prototype does not model the unsupported constructs of §2: brush offsets, harmonics, trill, tremolo, triplet feel, legato slides, and time-based note lengths.
- It does not compare pitch bends, program or control changes, or time signatures.
- Ties across a repeat or jump boundary use score positions, as alphaTab does; only simple cases are tested.
- MHD `velocity` is not used: alphaTab ignores it (S2-05), so parity is measured against dynamics.
- No import fixtures: real-world files (GP/MusicXML) would test more combinations. They depend on legally usable fixtures (S2-09 / S4, decision OQ2 in ROADMAP §Sprint 2) and were not used.
- Measured in Node with `MidiFileGenerator`; the player's own MIDI path and S7 (separate Playback Score playback) are not verified.
- "G3" is not defined in the repository documents. If it refers to the `segnoSegno` / `doubleCoda` gap: in MHD v1 both are unreachable markers (§6), and adding jumps to them would be a schema change (new `direction` values) that alphaTab already supports (directions 13–16 and 7, 11, 18).

## 8. Conclusion

- **S5 pass criterion:** met for every construct whose semantics MHD defines or leaves to the engine. Across 17 golden scenarios, note-on, note-off and tempo events match alphaTab exactly (repeats, endings, D.S., D.C., coda, Fine, ties, graces, tuplets, pickup, tempo changes, multiple tracks). The 30,748 comparable note-ons of the S2 corpus are also exact, except for the explained differences.
- **Not met** for two constructs where MHD and alphaTab disagree (D1) or MHD is silent (D2). These need owner decisions, not more code.
- **Architecture:** the timeline can be built independently from MHD with integer tick rules that reproduce alphaTab. No hidden data from alphaTab was needed beyond documented rules: grace lengths, tuplet truncation, tick shift and velocity formula. These rules are now pinned by tests and golden snapshots, which must be rerun on every alphaTab upgrade.
- **Readiness:** the playback-order and note-event design is ready to move into `music-model/timeline` in Phase 1 once D1, D2 and the [CONV] rules are decided. The unsupported constructs need either their own parity rules or a documented "engine-only" status.

## 9. Commands

From `spikes/s2-mhd-to-alphatab` (Node 26.13.1; `@musichub/music-model` built):

```bash
pnpm exec vitest run src/timeline   # 94 tests + 3 intentional skips; golden snapshots
pnpm test                           # whole spike (553 + 4 skipped)
```

Updating the golden snapshots (only after an intended alphaTab change): `pnpm exec vitest run src/timeline -u`.
