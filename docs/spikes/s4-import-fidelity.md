# Spike S4 — Import fidelity (ROADMAP S2-09)

> Status: **partly done.** MusicXML import evaluated on 14 original, hand-authored fixtures (13
> distinct musical contents plus one compressed container). **GP3, GP4, GP5, GP6/GPX, GP7 and GP8
> are not evaluated**: no independent, legally usable Guitar Pro files exist for this project, and
> the owner cannot provide them. The S4 criterion (20 public-domain/own GP3–8 and MusicXML files →
> MHD → GP7, coverage matrix) is **not met** and is not changed.

## 1. Question and criterion

MUSIC_ENGINE.md §10, S4: "Import fidelity: 20 public-domain/own GP3–8 + MusicXML files → MHD →
GP7 round-trip", done when a "coverage matrix [is] drafted". The criterion stays as written.

Fixture policy (owner decisions, ROADMAP.md §Sprint 2, 2026‑11‑24): **OQ2** options B + D (no
Guitar Pro purchase or paid software; TuxGuitar only for verified GP3–GP5 exports; hand-authored
and individually verified public-domain MusicXML; GP6–GP8 not evaluated without independent legal
files; alphaTab's `Gp7Exporter` output is never independent GP7 data); **OQ3** no alphaTab
test-data files. The owner has since stated that no Guitar Pro files can be provided; no tool was
installed and nothing was downloaded.

## 2. Results by evidence level

### 2.1 Verified (14 independently prepared MusicXML fixtures, alphaTab 1.9.0 import vs intent)

The intent of each fixture is written as MHD from the fixture's specification, independently of
alphaTab (§5). Against it, alphaTab's `MusicXmlImporter` imports these exactly (every entry equal;
the items marked † are compared after the spike converter, at the MHD stage, see below):

- structure, multiple parts with their MIDI programs (1-based MusicXML → GM), staff display, clefs
  (treble, bass, percussion), guitar tuning; a TAB staff arrives as tab-only display with clef G2,
  which is the MHD default for a guitar staff (MHD v1 has no TAB clef);
- time signatures (4/4, 3/4, 6/8) and key signatures (major and minor), accidentals;
- tempo, including a change in the middle of a bar;
- repeats, first and second endings, segno, To Coda, coda;
- fermata; voices, a two-staff grand staff; rhythm with dots and tuplets; rests; chords; pitch;
  ties across and within bars; string and fret;
- unpitched percussion (GM keys 36, 38, 42 from 1-based `midi-unpitched`);
- a transposing instrument: sounding pitch and the written-to-sounding offset (−2);
- lyrics†; dynamics p, mf, ff (also checked on the imported Score); staccato†; accent and strong
  accent (also checked on the imported Score as `AccentuationType`);
- a compressed `.mxl` container (same result as the uncompressed file).

Deviations found, each pinned by a test:

1. **D.S. al Coda → Dal Segno** (mx07). MusicXML's `<sound dalsegno>` has no "al Coda" form and
   alphaTab treats the words "D.S. al Coda" as the label of that direction (§4).
2. **Spaces in part names become U+00A0 (no-break space)** (mx08 "Acoustic Guitar", mx12
   "Clarinet in Bb"). Program and percussion flag are correct; `trackInfo` counts as unsupported
   because the whole entry differs.
3. **Grace timing** (mx10): an unslashed grace with `steal-time-previous` (intended before the beat)
   is imported as on-beat, which also moves its main beat by the grace's length; the slashed and the
   `steal-time-following` graces arrive as intended. alphaTab does not read the steal-time
   attributes (§4).

Content MHD v1 cannot hold (not an import failure): **tenuto** (mx06, imported by alphaTab as
`AccentuationType.Tenuto`) and **slur** (mx13). The converter reports both as losses.

Not evaluated within MusicXML: the **key signature of a transposing staff** (mx12). MHD v1 does not
define whether `MasterBar.keySignature` is the written or the concert key; alphaTab stores the
written key (2 sharps) with `displayTranspositionPitch = −2` (an observation, not a result). This
is an open MHD question.

### 2.2 Partially verified (alphaTab on both sides)

These stages use alphaTab as input *and* as output, so they show what survives MusicHub's own path,
not independent compatibility:

- **Score → MHD (spike converter):** all 14 converted documents are valid MHD v1 and match the
  intent in the same groups as the import (deviations 1–3 carry over; the rhythm shift of
  deviation 3 does not appear, because MHD computes ticks without grace time). The converter reports
  every feature it does not convert as a loss; here `note.accent.tenuto`, `note.slur` and, for every
  track, `track.instrument.family` (alphaTab has no instrument family).
- **Re-import stability:** importing a fixture's bytes a second time and converting again gives an
  identical JSON serialisation of the converted MHD document and an equal loss list (14/14). It
  checks determinism of import + conversion, not the identity of files or of alphaTab objects.

† Lyrics and staccato are verified against the independent intent only through the converter
output: the facts of the imported Score have no lyrics or staccato group, and no direct Score
check exists for them.
- **GP7 round trip** (MHD → alphaTab → `Gp7Exporter` → `Gp7To8Importer`, compared with the first
  import): every exercised group survives, sounding pitch included, **except that non-guitar,
  non-percussion staves come back as stringed staves** (a guitar or bass tuning, string and fret per
  note): 12 fixtures. The guitar (mx08) and percussion (mx11) fixtures round-trip without any
  difference. Whether the exporter or the importer causes it was not isolated. This is a round trip
  through alphaTab's own GP7 code and **not evidence of GP7 or GP8 import compatibility**.

### 2.3 Not evaluated

| Format | Reason |
|---|---|
| GP3 (`.gp3`) | No independent, legally usable fixture |
| GP4 (`.gp4`) | No independent, legally usable fixture |
| GP5 (`.gp5`) | No independent, legally usable fixture |
| GP6 (`.gpx`) | No independent, legally usable fixture |
| GP7 (`.gp`) | No independent, legally usable fixture; `Gp7Exporter` output is not one |
| GP8 (`.gp`) | No independent, legally usable fixture |
| Public-domain MusicXML | Sources not approved; no downloads in scope |

**The absence of GP files is a limitation of the test data, not evidence that alphaTab's GP
importers are incompatible.** alphaTab 1.9.0 contains `Gp3To5Importer`, `GpxImporter` and
`Gp7To8Importer` (§4); nothing in this spike tested them on independent files, so nothing is known
about their fidelity — neither good nor bad. The gap can be closed later if legally usable GP files
appear (own files from a free editor whose export is verified, or files with a recorded licence),
using the same pipeline and tests.

## 3. Answer in short

| Question | Answer |
|---|---|
| Does alphaTab 1.9.0 import MusicXML faithfully? | For the 13 synthetic contents here: yes, with three deviations (§2.1). Not shown for real-world editor output |
| Can the result become MHD? | Yes for this feature set, with explicit losses for tenuto, slur and instrument family |
| GP3–GP8? | Not evaluated |
| Criterion met? | No: 14 MusicXML files, 0 GP files, of 20 GP3–8 + MusicXML files |

## 4. Source evidence (alphaTab 1.9.0)

Line numbers refer to `node_modules/@coderline/alphatab/dist/alphaTab.core.mjs`.

| What | Where | Finding |
|---|---|---|
| Importers | `Gp3To5Importer` 18699, `Gp7To8Importer` 22560, `GpxImporter` 22840, `MusicXmlImporter` 23890, `CapellaImporter` 18642 | GP3–GP8, MusicXML and Capella can be read |
| Exporters | `AlphaTexExporter` 76625, `Gp7Exporter` 78957 | Only GP7 and alphaTex can be written: no GP3–GP6 or MusicXML export |
| Navigation from `<sound>` (`_parseSoundDirections`) | 24576–24604 | `tocoda` → `JumpDaCoda` (17), `dacapo` → `JumpDaCapo` (5), `dalsegno` → `JumpDalSegno` (9), `fine`, `segno`; there is no MusicXML attribute for "al Coda" |
| Navigation from words (`_soundDirectionLabels`, `_isSoundDirectionLabel`) | 24611–24660 | `<words>` whose normalised text is a label of a `<sound>` direction (MuseScore defaults, including `dalsegnoalcoda` under `dalsegno`) are treated as the visual counterpart of that direction and not kept as text; they do not select a combined direction (mx07) |
| Grace notes (`<grace>`) | 25473–25481 | `make-time` or `slash="yes"` → `BeforeBeat`, otherwise `OnBeat`; `steal-time-previous` / `steal-time-following` are not read (mx10) |
| Transposition (`_parseTranspose`) | 24979–24996 | `chromatic` + 12 × `octave-change` → `Staff.displayTranspositionPitch`; notes are stored at sounding pitch (mx12) |
| Compressed MusicXML | 23953–23985 | `.mxl` is read through `META-INF/container.xml` (mx14) |

## 5. Pipeline and method

```
fixture (.musicxml/.mxl) ─▶ alphaTab ScoreLoader (MusicXmlImporter) ─▶ Score       stage "import"
Score ─▶ fromAlphaTab (spike converter) ─▶ MHD v1 + losses ─▶ validateDocument     stage "mhd"
MHD ─▶ toAlphaTabDirect (S2 Strategy A) ─▶ Gp7Exporter ─▶ Gp7To8Importer ─▶ Score  stage "gp7"
```

- **Intent** (`src/import/intent.ts`): the intended content of each fixture as MHD, written from the
  fixture's specification, independently of alphaTab; content MHD v1 cannot hold is listed in
  `notInMhd`; groups MHD does not define for a fixture are listed in `notEvaluated` with the reason.
  Interpretation rules taken from MusicXML: 1-based `<midi-program>` and `<midi-unpitched>`;
  `<transpose>` is added to the written pitch to get the sounding pitch; `steal-time-previous` means
  before the beat, `steal-time-following` on the beat.
- **Comparison** (`src/import/evaluate.ts`): the S2 fact groups (`src/facts.ts`) as multisets with
  **exact JSON equality, no tolerance** (ticks and fractions are exact). Stated reductions:
  `trackInfo` keeps name, MIDI program and percussion (mixer volume and pan are engine defaults);
  `soundingPitch` is `pitch` without string and fret. Dynamics, note effects and lyrics are extra
  groups at the MHD stage; dynamics (mx05) and accent types including tenuto (mx06) are also checked
  directly on the imported Score, lyrics and staccato are not.
- **Status per group:** *supported* (all entries equal), *partial* (some), *unsupported* (none),
  *not exercised* (empty on both sides), *not evaluated* (the intent does not define it).
- **Converter** (`src/import/from-alphatab.ts`): minimal alphaTab Score → MHD v1 for the fixtures'
  features; everything else it finds is a named loss with its position (tenuto, slurs, bends,
  slides, harmonics, vibrato, ornaments, trills, guitar techniques, brush, crescendo, sustain pedal,
  clef ottava, triplet feel, additional directions, unknown durations and dynamics, sounding
  transposition, instrument family). Expected transformation: a dynamic mark is written where the
  dynamic changes; alphaTab gives every beat a dynamic (default F), so an explicit `f` on the very
  first beat cannot be told from no mark. Research code only, not the Phase 1 importer.
- **Negative control:** a deliberately wrong expectation is detected (test "detects a wrong
  expectation").

Reproduce: `pnpm --filter @musichub/spike-s2-mhd-to-alphatab test` (S4 tests in
`src/import/import-fidelity.test.ts`) and `pnpm --filter @musichub/spike-s2-mhd-to-alphatab
import-fidelity` (prints §7).

## 6. Fixtures

14 files in `spikes/s2-mhd-to-alphatab/fixtures/import/musicxml/`, original own work of the MusicHub
project, labelled synthetic, written 2026‑11‑24: mx01–mx08 (first set, unchanged) and mx09–mx14
(second set). Provenance, purpose and SHA-256 per file: `fixtures/import/SOURCES.md` (verified by the
tests).

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
| mx09-multiple-parts | two parts (flute, cello), programs and clefs |
| mx10-grace-notes | grace notes with `steal-time-previous` / `steal-time-following`, slashed and unslashed |
| mx11-percussion | unpitched bass drum, snare, closed hi-hat; a chord |
| mx12-transposing | B♭ clarinet, `<transpose>` −2 |
| mx13-lyrics-slur | lyrics on every note; a slur |
| mx14-compressed | compressed `.mxl` with the content of mx01 |

Toward the 20 of the criterion: 14 MusicXML files (13 distinct contents), 0 Guitar Pro files.

Tools: none installed (`/Applications` and `PATH` have no Guitar Pro, TuxGuitar, MuseScore,
Sibelius, Finale or Dorico). Candidate public-domain MusicXML sources (OpenScore, expected CC0;
Mutopia, per-piece public domain or Creative Commons) were neither accessed nor downloaded.

## 7. Coverage matrix (14 MusicXML fixtures, alphaTab 1.9.0)

✅ supported · 🟡 partial (matched/expected) · ❌ unsupported · — not exercised · n/e not evaluated.
Stages: "import" (alphaTab vs intent, **verified**), "mhd" (converted MHD vs intent, alphaTab input),
"gp7" (Score after the GP7 round trip vs the first import, alphaTab on both sides).

| Fixture | Stage | structure | trackInfo | staffDisplay | tuning | transposition | clef | timeSignature | keySignature | tempo | anacrusis | repeats | alternateEndings | directions | sections | fermata | voices | rhythm | grace | rests | chords | pitch | ties | percussion | soundingPitch | dynamics | noteEffects | lyrics |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mx01-notes-rests | import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | ✅ | — | — | ✅ | — | — | — |
| mx01-notes-rests | mhd | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | ✅ | — | — | ✅ | — | — | — |
| mx01-notes-rests | gp7 | ✅ | ✅ | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | ❌ 0/9 | — | — | ✅ | — | — | — |
| mx02-meter-key | import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — | — |
| mx02-meter-key | mhd | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — | — |
| mx02-meter-key | gp7 | ✅ | ✅ | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ❌ 0/12 | — | — | ✅ | — | — | — |
| mx03-ties-tuplets | import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — | — |
| mx03-ties-tuplets | mhd | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — | — |
| mx03-ties-tuplets | gp7 | ✅ | ✅ | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ❌ 0/13 | ✅ | — | ✅ | — | — | — |
| mx04-voices-staves | import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — | — |
| mx04-voices-staves | mhd | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — | — |
| mx04-voices-staves | gp7 | ✅ | ✅ | ✅ | ❌ 0/2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ❌ 0/9 | — | — | ✅ | — | — | — |
| mx05-tempo-dynamics | import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — | — |
| mx05-tempo-dynamics | mhd | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | ✅ | — | — |
| mx05-tempo-dynamics | gp7 | ✅ | ✅ | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ❌ 0/7 | — | — | ✅ | — | — | — |
| mx06-articulations | import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — | — |
| mx06-articulations | mhd | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | ✅ | — |
| mx06-articulations | gp7 | ✅ | ✅ | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ❌ 0/5 | — | — | ✅ | — | — | — |
| mx07-repeats-navigation | import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 6/7 | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — | — |
| mx07-repeats-navigation | mhd | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 6/7 | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — | — |
| mx07-repeats-navigation | gp7 | ✅ | ✅ | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ❌ 0/7 | — | — | ✅ | — | — | — |
| mx08-guitar-tab | import | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | — | — | ✅ | — | — | — |
| mx08-guitar-tab | mhd | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | — | — | ✅ | — | — | — |
| mx08-guitar-tab | gp7 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | — | — | ✅ | — | — | — |
| mx09-multiple-parts | import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — | — |
| mx09-multiple-parts | mhd | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — | — |
| mx09-multiple-parts | gp7 | ✅ | ✅ | ✅ | ❌ 0/2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ❌ 0/2 | — | — | ✅ | — | — | — |
| mx10-grace-notes | import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 4/6 | 🟡 2/3 | — | — | ✅ | — | — | ✅ | — | — | — |
| mx10-grace-notes | mhd | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 2/3 | — | — | ✅ | — | — | ✅ | — | — | — |
| mx10-grace-notes | gp7 | ✅ | ✅ | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ❌ 0/6 | — | — | ✅ | — | — | — |
| mx11-percussion | import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | — | — | ✅ | — | — | — | — |
| mx11-percussion | mhd | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | — | — | ✅ | — | — | — | — |
| mx11-percussion | gp7 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | — | — | ✅ | — | — | — | — |
| mx12-transposing | import | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | n/e | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — | — |
| mx12-transposing | mhd | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | n/e | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — | — |
| mx12-transposing | gp7 | ✅ | ✅ | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ❌ 0/3 | — | — | ✅ | — | — | — |
| mx13-lyrics-slur | import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — | — |
| mx13-lyrics-slur | mhd | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — | ✅ |
| mx13-lyrics-slur | gp7 | ✅ | ✅ | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ❌ 0/3 | — | — | ✅ | — | — | — |
| mx14-compressed | import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | ✅ | — | — | ✅ | — | — | — |
| mx14-compressed | mhd | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | ✅ | — | — | ✅ | — | — | — |
| mx14-compressed | gp7 | ✅ | ✅ | ✅ | ❌ 0/1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | ❌ 0/9 | — | — | ✅ | — | — | — |

## 8. Limitations

- **Synthetic MusicXML only.** Each feature is exercised in isolation by its author; real editor
  output (MuseScore, Finale, Sibelius, Dorico) has other conventions. No general MusicXML claim.
- **No Guitar Pro evidence at all** (§2.3); no GP3–GP8 claim in either direction.
- The intent is the author's reading of MusicXML; an error in it would show as a deviation (the
  negative control shows such errors are detected, not that none exist).
- The converter covers these features only; its loss list is the boundary, not a complete importer.
- Not evaluated within MusicXML: chord symbols, ornaments, multi-verse lyrics, cross-staff notes,
  multiple percussion techniques, `score-timewise`, MusicXML versions other than 4.0, partial or
  malformed files.

## 9. Status and open items

S2-09 is **partly done**: method, converter, 14 legally sound fixtures, 97 deterministic tests and
the coverage matrix exist; the S4 criterion is **not met** (no GP files; 14 of 20 files). Open, not
in the current scope:

1. GP3–GP8: legally usable, independent fixtures (own files from a free editor with verified export,
   or files with a recorded licence). The pipeline and tests can take them unchanged.
2. Public-domain or editor-exported MusicXML, after source approval.
3. MHD question: written or concert key signature for transposing staves (mx12).

Validation (2026‑11‑24, agent): `pnpm format:check` clean; `pnpm depcruise` no violations (143
modules); `pnpm turbo run lint typecheck test build --force` 24/24 tasks (S2 spike: 673 passed, 4
skipped, of which 97 S4); S7 browser tests 4/4, S6 smoke 4/4, S1 end-to-end 2/2.

No ADR change: the findings need no architecture decision. They are inputs for the Phase 1 importer
(direction mapping, grace timing, name normalisation, tenuto and slur in MHD, the GP7 export path).
