# Spike S4 — Import fidelity (ROADMAP S2-09)

> Status: **partly done.** MusicXML import evaluated on 8 original, hand-authored fixtures.
> GP3–GP5 pending (TuxGuitar not installed, approval needed); GP6–GP8 not evaluated (OQ2);
> no public-domain files yet (approval needed). The S4 criterion (20 public-domain/own GP3–8 and
> MusicXML files → MHD → GP7, coverage matrix) is **not met**; this report does not claim GP3–GP8
> or general MusicXML compatibility.

## 1. Question and criterion

MUSIC_ENGINE.md §10, S4: "Import fidelity: 20 public-domain/own GP3–8 + MusicXML files → MHD →
GP7 round-trip", done when a "coverage matrix [is] drafted". The criterion is unchanged here.

Fixture policy (owner decisions recorded in ROADMAP.md §Sprint 2, 2026‑11‑24):

- **OQ2: options B + D.** No Guitar Pro purchase, no paid software. GP3–GP5 from TuxGuitar only for
  formats it is verified to *export*; MusicXML from original hand-authored fixtures and individually
  verified public-domain files; GP6–GP8 not evaluated without independent legal files; alphaTab's
  `Gp7Exporter` output is never independent GP7 reference data.
- **OQ3: no** alphaTab test-data files.
- Tools and downloads need the owner's approval first.

## 2. Answer in short

| Format | Fixtures | Result |
|---|---|---|
| MusicXML 4.0 (hand-authored, synthetic) | 8 | alphaTab 1.9.0 imports every exercised feature group as intended, except **D.S. al Coda → Dal Segno** (mx07) and a **no-break space in a part name** (mx08). Tenuto is imported but MHD v1 cannot hold it |
| MusicXML (public domain) | 0 | pending owner approval of sources (§5.3) |
| GP3, GP4, GP5 | 0 | pending: TuxGuitar is not installed (§5.2) |
| GP6 (`.gpx`) | 0 | not evaluated (OQ2) |
| GP7, GP8 (`.gp`) | 0 | not evaluated (OQ2). The round trip writes GP7 with alphaTab itself, which is not independent GP7 input |

Through the spike's alphaTab → MHD converter every fixture becomes valid MHD v1 that matches the
intent in the same groups. In the GP7 round trip the sounding pitch of every note survives, but
**non-guitar staves come back as stringed staves** (a guitar or bass tuning, string and fret per note).

## 3. Source evidence (alphaTab 1.9.0)

Line numbers refer to `node_modules/@coderline/alphatab/dist/alphaTab.core.mjs`.

| What | Where | Finding |
|---|---|---|
| Importers | `Gp3To5Importer` 18699, `Gp7To8Importer` 22560, `GpxImporter` 22840, `MusicXmlImporter` 23890, `CapellaImporter` 18642 | GP3–GP8, MusicXML and Capella can be read |
| Exporters | `AlphaTexExporter` 76625, `Gp7Exporter` 78957 | Only GP7 and alphaTex can be written: no GP3–GP6 or MusicXML export |
| Navigation from `<sound>` (`_parseSoundDirections`) | 24576–24604 | `tocoda` → `JumpDaCoda` (17), `dacapo` → `JumpDaCapo` (5), `dalsegno` → `JumpDalSegno` (9), `fine`, `segno`; there is no MusicXML attribute for "al Coda" |
| Navigation from words (`_soundDirectionLabels`, `_isSoundDirectionLabel`) | 24611–24660 | `<words>` whose normalised text is a label of a `<sound>` direction (MuseScore defaults, including `dalsegnoalcoda` under `dalsegno`) are treated as the visual counterpart of that direction and not kept as text; they do not select a combined direction (mx07) |

## 4. Pipeline and method

```
fixture (.musicxml) ─▶ alphaTab ScoreLoader (MusicXmlImporter) ─▶ Score            stage "import"
Score ─▶ fromAlphaTab (spike converter) ─▶ MHD v1 + losses ─▶ validateDocument     stage "mhd"
MHD ─▶ toAlphaTabDirect (S2 Strategy A) ─▶ Gp7Exporter ─▶ Gp7To8Importer ─▶ Score  stage "gp7"
```

- **Intent** (`src/import/intent.ts`): the intended content of each fixture as MHD, written from the
  same specification as the MusicXML file and independently of alphaTab. It is the reference for the
  "import" and "mhd" stages. MHD content that MHD v1 cannot express is listed separately
  (`notInMhd`), never added.
- **Comparison** (`src/import/evaluate.ts`): the S2 fact groups (`src/facts.ts`), i.e. musical
  semantics per track, staff, bar, voice, beat and note, compared as multisets with **exact JSON
  equality, no tolerance** (positions and durations are exact ticks and fractions). Two reductions,
  both stated in the code: `trackInfo` keeps name, MIDI program and percussion only (mixer volume and
  pan are engine defaults, not fixture content), and `soundingPitch` is `pitch` without string and fret.
  Dynamics and note effects (staccato, accents) are compared as extra groups at the MHD stage and
  checked directly on the imported Score.
- **Status per group:** *supported* (all entries equal), *partial* (some equal), *unsupported* (none
  equal), *not exercised* (no entries on either side). "Not evaluated" is reserved for formats
  without fixtures (§2).
- **Converter** (`src/import/from-alphatab.ts`): minimal alphaTab Score → MHD v1 for the features
  the fixtures exercise. Everything else it finds is reported as a **loss** with a feature name and
  position (tenuto, slurs, bends, slides, harmonics, vibrato, ornaments, trills, guitar techniques,
  lyrics, brush, crescendo, sustain pedal, clef ottava, triplet feel, extra directions, unknown
  durations and dynamics, sounding transposition); alphaTab has no instrument family, so every
  track reports `track.instrument.family`. It is research code, not the Phase 1 `fromAlphaTab`.
- **Independence:** only the "import" stage compares alphaTab with an independent reference. The
  "mhd" and "gp7" stages use alphaTab on both sides (converter input; GP7 writer and reader) and
  show what survives MusicHub's own path, not GP7 compatibility.

Expected transformations (by design, not failures): the dynamic rule of the converter (a mark where
the dynamic changes; alphaTab gives every beat a dynamic, default F, so an explicit `f` on the very
first beat cannot be told from no mark), the mixer default, and grace beat start ticks (hidden by
`mhdComparable` as in S2).

Reproduce: `pnpm --filter @musichub/spike-s2-mhd-to-alphatab test` (S4 tests in
`src/import/import-fidelity.test.ts`) and `pnpm --filter @musichub/spike-s2-mhd-to-alphatab
import-fidelity` (prints the matrix in §6).

## 5. Fixtures

### 5.1 Inventory (legally verified)

Eight original MusicXML 4.0 files in `spikes/s2-mhd-to-alphatab/fixtures/import/musicxml/`, written
for this spike on 2026‑11‑24, own work of the MusicHub project, labelled synthetic. Provenance,
purpose and SHA-256 of every file: `fixtures/import/SOURCES.md` (checked by the tests).

| Fixture | Coverage |
|---|---|
| mx01-notes-rests | notes and rests, whole to 16th, dotted quarter, whole-measure rest |
| mx02-meter-key | 4/4 → 3/4 → 6/8; G major → F major → A minor; accidentals |
| mx03-ties-tuplets | tie across a barline and within a bar; eighth and quarter triplets |
| mx04-voices-staves | piano grand staff (treble, bass clef), two voices on the upper staff |
| mx05-tempo-dynamics | tempo 90 → 120 at half of bar 2; p, mf, ff |
| mx06-articulations | staccato, accent, strong accent, tenuto, fermata |
| mx07-repeats-navigation | repeat with 1st/2nd ending; segno, To Coda, D.S. al Coda, coda |
| mx08-guitar-tab | TAB staff, standard tuning, string/fret, five-note chord |

Counted toward the 20 of the S4 criterion: **8** (all MusicXML, all synthetic). No other file is in
the corpus.

### 5.2 Tools (none installed; inspected without changes)

`/Applications` and `PATH` contain no Guitar Pro, TuxGuitar, MuseScore, Sibelius, Finale or Dorico.

| Tool | Purpose | Licence | Expected output | Status |
|---|---|---|---|---|
| TuxGuitar (free, open source) | Author own GP3/GP4/GP5 fixtures | LGPL (to confirm for the version) | `.gp3`, `.gp4`, `.gp5` — **export of each must be verified after installation**; opening a format is no proof | needs owner approval to install |
| MuseScore 4 (free, open source) | Optional: export own scores to MusicXML from a real editor (more realistic than hand-written XML) | GPL-3.0 (to confirm) | `.musicxml`, `.mxl` | optional; needs approval |

### 5.3 Candidate public-domain sources (not downloaded)

| Source | Expected terms (to verify per file) | Notes |
|---|---|---|
| OpenScore (Lieder and other corpora) | CC0 public-domain dedication of the editions | Files in MuseScore format; MusicXML may need export with MuseScore; licence and edition must be recorded per file |
| Mutopia Project | Per piece: public domain or a Creative Commons licence | Mostly LilyPond sources; MusicXML only for some pieces |

Neither source was accessed or downloaded. A file is added only after the owner approves the source
and its licence is recorded in `SOURCES.md`.

## 6. Coverage matrix (8 MusicXML fixtures, alphaTab 1.9.0)

✅ supported · 🟡 partial (matched/expected) · ❌ unsupported · — not exercised. Stages: "import"
(alphaTab vs intent), "mhd" (converted MHD vs intent), "gp7" (Score after the GP7 round trip vs
the imported Score).

| Fixture | Stage | structure | trackInfo | staffDisplay | tuning | transposition | clef | timeSignature | keySignature | tempo | anacrusis | repeats | alternateEndings | directions | sections | fermata | voices | rhythm | grace | rests | chords | pitch | ties | percussion | soundingPitch | dynamics | noteEffects |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mx01-notes-rests | import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | ✅ | — | — | ✅ | — | — |
| mx01-notes-rests | mhd | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | ✅ | — | — | ✅ | — | — |
| mx01-notes-rests | gp7 | ✅ | ✅ | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | ❌ 0/9 | — | — | ✅ | — | — |
| mx02-meter-key | import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — |
| mx02-meter-key | mhd | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — |
| mx02-meter-key | gp7 | ✅ | ✅ | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ❌ 0/12 | — | — | ✅ | — | — |
| mx03-ties-tuplets | import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — |
| mx03-ties-tuplets | mhd | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — |
| mx03-ties-tuplets | gp7 | ✅ | ✅ | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ❌ 0/13 | ✅ | — | ✅ | — | — |
| mx04-voices-staves | import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — |
| mx04-voices-staves | mhd | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — |
| mx04-voices-staves | gp7 | ✅ | ✅ | ✅ | ❌ 0/2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ❌ 0/9 | — | — | ✅ | — | — |
| mx05-tempo-dynamics | import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — |
| mx05-tempo-dynamics | mhd | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | ✅ | — |
| mx05-tempo-dynamics | gp7 | ✅ | ✅ | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ❌ 0/7 | — | — | ✅ | — | — |
| mx06-articulations | import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — |
| mx06-articulations | mhd | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | ✅ |
| mx06-articulations | gp7 | ✅ | ✅ | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ❌ 0/5 | — | — | ✅ | — | — |
| mx07-repeats-navigation | import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 6/7 | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — |
| mx07-repeats-navigation | mhd | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 6/7 | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — |
| mx07-repeats-navigation | gp7 | ✅ | ✅ | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ❌ 0/7 | — | — | ✅ | — | — |
| mx08-guitar-tab | import | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | — | — | ✅ | — | — |
| mx08-guitar-tab | mhd | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | — | — | ✅ | — | — |
| mx08-guitar-tab | gp7 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | — | — | ✅ | — | — |

## 7. Findings

1. **D.S. al Coda becomes Dal Segno** (mx07, import, carried into MHD): MusicXML's `<sound
   dalsegno>` has no "al Coda" form, and alphaTab treats the words "D.S. al Coda" as the label of
   that `dalsegno` direction (§3), so the combined direction is never formed. The jump target and the To Coda/coda markers arrive; playback semantics of the
   combined direction are lost. Classified *partial* (6 of 7 directions).
2. **No-break space in a part name** (mx08): "Acoustic Guitar" becomes `Acoustic\u00a0Guitar`.
   Classified *unsupported* for `trackInfo` because the whole entry differs; program and percussion
   are correct. The converter keeps the character (no silent normalisation).
3. **Tenuto** (mx06): imported as `AccentuationType.Tenuto`; MHD v1 has no tenuto, so the converter
   reports `note.accent.tenuto` as a loss. Staccato, accent and strong accent convert exactly.
4. **Dynamics** (mx05) p, mf, ff arrive on the intended beats; the converter's change rule gives the
   intended marks.
5. **GP7 round trip makes non-guitar staves stringed** (mx01–mx07): after `Gp7Exporter` and
   `Gp7To8Importer` a piano staff has a guitar tuning (64 59 55 50 45 40) and the bass staff of mx04
   a 5-string bass tuning, with string and fret on every note. Sounding pitches are unchanged
   (`soundingPitch` ✅). Whether the exporter or the importer causes it was not isolated. The guitar
   fixture (mx08) round-trips without any difference.
6. **Exact matches** in all other exercised groups: structure, staff display, tuning, clefs, time and
   key signatures, tempo (including a mid-bar change), repeats, alternate endings, fermata, voices,
   rhythm (dots, tuplets), rests, chords, pitch, ties.

## 8. Limitations

- **Eight synthetic files, one format.** They exercise each feature in isolation, chosen by the
  author; real-world MusicXML from editors (MuseScore, Finale, Sibelius, Dorico) has other
  conventions. No claim of general MusicXML compatibility follows.
- **No GP files at all:** GP3–GP5 pending tools; GP6–GP8 not evaluated. No GP3–GP8 claim.
- The intent is the author's reading of MusicXML semantics (e.g. 1-based `<midi-program>`, sounding
  pitch on the TAB staff); an error in it would show as a deviation, and the negative control in the
  tests shows that a wrong expectation is detected.
- The converter covers the fixtures' features only; its loss list is the boundary, not a complete
  MHD importer.
- The "mhd" and "gp7" stages are not independent of alphaTab (§4).
- Not evaluated: lyrics, chord symbols, slurs, ornaments, grace notes from MusicXML, percussion,
  transposing instruments, multiple parts, compressed `.mxl`, `score-timewise`.

## 9. Status and open items

S2-09 is **partly done**: methodology, converter, eight legally sound fixtures, tests and a first
coverage matrix exist; the S4 criterion is not met (8 of 20 files, MusicXML only). Needed from the
owner to continue:

1. Approval to install TuxGuitar, to produce and verify own GP3/GP4/GP5 fixtures.
2. Approval of public-domain MusicXML sources (§5.3), then per-file licence checks.
3. Optional: approval of MuseScore 4 for editor-exported own MusicXML.
4. GP6–GP8 stay not evaluated unless an independent legal source appears (OQ2).

No ADR change: the findings do not require an architecture decision. They are inputs for the
Phase 1 importer (direction mapping, tenuto in MHD, name normalisation policy, the GP7 export path).
