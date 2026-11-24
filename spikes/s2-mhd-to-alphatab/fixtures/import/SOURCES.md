# Import fixtures — sources and licences (spike S4, ROADMAP S2-09)

Every file here is counted as a fixture only with its provenance and licence recorded below
(AGENT_RULES.md: own work, public domain or explicit licence; never copyrighted commercial tabs).
Fixture policy: ROADMAP.md §Sprint 2, decisions OQ2 (options B + D) and OQ3 (no alphaTab
test-data files). The SHA-256 checksums are verified by `src/import/import-fidelity.test.ts`.

## MusicXML — original, hand-authored (synthetic)

All eight files were written on 2026‑11‑24 specifically for MusicHub spike S4. They are
**synthetic test content, not real-world third-party scores**: original note sequences with no
melodic or textual source. Authored with a throw-away script that wrote the XML literally; each
file states its purpose in a header comment.

- **Author / creator:** MusicHub project (own work).
- **Licence:** own work of the MusicHub project, under the repository's terms; no third-party rights.
- **Format:** MusicXML 4.0, `score-partwise`, uncompressed `.musicxml`, with the standard DOCTYPE.
- **Kind:** original (not exported by an application, not externally sourced).
- **Expected content:** written independently as MHD in `src/import/intent.ts` from the same specification, not derived from alphaTab.
- **Conventions:** `divisions` = 12 per quarter; MIDI program numbers 1-based as MusicXML defines them (`<midi-program>1</midi-program>` = GM 0); the guitar fixture writes **sounding** pitch on a single TAB staff (no `<transpose>`).

| File | SHA-256 | Purpose / coverage |
|---|---|---|
| `musicxml/mx01-notes-rests.musicxml` | `9f4f1fa30037a597bc3ded7f0aa158f6af04c8d81526ec67a32c203efdb15cf6` | Notes and rests, whole to 16th, a dotted quarter, a whole-measure rest |
| `musicxml/mx02-meter-key.musicxml` | `92dffa92d9790126f76966ed70c59a42e066570df898cbfc9f3436dbb04d9157` | Time signatures 4/4 → 3/4 → 6/8; keys G major → F major → A minor; sharp, flat accidentals |
| `musicxml/mx03-ties-tuplets.musicxml` | `71116fd7608a7373a31bc3e0d5787b152836beb7cc51d5620752e1450d8fc32f` | A tie across a barline, a tie within a bar, eighth and quarter triplets |
| `musicxml/mx04-voices-staves.musicxml` | `03ac4682137ffb9d00ca58e0e5a00fb3937564ba9294084335293111357dc77f` | Piano grand staff (treble + bass clef), two voices on the upper staff (`<backup>`) |
| `musicxml/mx05-tempo-dynamics.musicxml` | `4a23a1bedb8af66637f94b2a81370757b74a40d238fba6057cc3eac4ef46901b` | Tempo 90, change to 120 at half of bar 2; dynamics p, mf, ff |
| `musicxml/mx06-articulations.musicxml` | `4018443540ac5c525c6a1cbaf8c527a7637e63a94a74f72b89accd42dd46bc3e` | Staccato, accent, strong accent, tenuto (not in MHD v1), fermata |
| `musicxml/mx07-repeats-navigation.musicxml` | `e4fbb42d120f865ae97d3b356ad24f958c5d88b7347c2045856f03f59c5a59c2` | Repeat with 1st and 2nd ending; segno, To Coda, D.S. al Coda, coda |
| `musicxml/mx08-guitar-tab.musicxml` | `73436ba6f839ba2d853787188cfc098a994a5a36dbed180827ea02fcb7a9870a` | Guitar TAB staff, standard tuning, string and fret per note, a five-note chord |

## Not present (pending sources)

| Category | Status | Needs |
|---|---|---|
| GP3, GP4, GP5 | none | TuxGuitar installed (owner approval) and its *export* of each version verified |
| GP6 `.gpx` | not evaluated | an independent, legally usable source |
| GP7, GP8 `.gp` | not evaluated | an independent, legally usable source; alphaTab `Gp7Exporter` output is not independent reference data |
| Public-domain MusicXML | none | owner approval of the sources, then a per-file licence check recorded here |
| alphaTab test-data files | excluded | OQ3: not approved |
