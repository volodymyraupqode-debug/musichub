# MHD v1 canonical fixtures

Hand-written MHD v1 documents used as golden test data for `@musichub/music-model` (ROADMAP.md S2-03). Each fixture has an expected-result sidecar next to it. The tests live in `src/fixtures.test.ts`.

## Fixtures

| Fixture | Purpose | Scenarios covered |
|---|---|---|
| `guitar-basic.mhd.json` | Stringed-instrument model and tablature | Guitar track with standard notation + tab, standard tuning, capo 2, 24 frets, 4 bars in 4/4. Chord with a brush (`duration` 1/32), triplet eighths with palm mute, dotted quarter with a slide, hammer-on, bend (0 → 4 → 0 quarter tones), grace note, vibrato, natural harmonic, two voices in bar 3, rests, and a tie across the bar line (string 1, fret 12) |
| `piano-grand-staff.mhd.json` | Keyboard grand staff and the sustain pedal | Piano track with two staves: right hand (`G2`) and left hand (`F4`). Chords in both hands, two voices in the right hand, a left-hand-staff note played by the right hand (`Note.hand`), `8va`, a tie, a tempo change at `[1, 2]` labelled `rit.`, and pedal down/up events including a pedal held across the bar line |
| `band-repeats.mhd.json` | Multi-track structure, repeats and navigation | Guitar (tab), bass (4 strings), drums (`percussion: true`) and keys (`synth`) on one shared master-bar structure: pickup bar, repeat start, ending 1 with `repeatEnd.count` 2, ending 2, segno, to coda, `dalSegnoAlCoda` in a 3/4 bar, coda back in 4/4. Drum notes use GM keys with `drumTechnique` (`halfOpen`, `rimshot`, `edge`, `choke`) |
| `notation-semantics.mhd.json` | MHD v1 notation semantics (ADR-0002 A20–A23) | B♭ clarinet (`woodwinds`, `transpositionPitch` −2) and a piano grand staff over 3 bars in 4/4; concert key F major, changing to D major in bar 3 (written keys G and E major for the clarinet). Tenuto alone, with an accent and with staccato; sounding spellings; clarinet slurs that overlap, nest across the bar line and chain; piano slurs across voices and across staves; dynamics `p`/`mf` on the clarinet and `mp` in one piano voice only (the other voice stays at the default `f`) |

## Rules for canonical fixtures

- **Zero issues (O1):** every fixture passes `validateDocument` with `valid: true` and `issues: []`. Warnings count as issues, so no fixture may produce a warning.
- **Original content (O2):** all fixtures are original synthetic fragments written for MusicHub. Nothing is copied from copyrighted compositions, Guitar Pro or MusicXML files, or commercial scores. `meta.copyright` is `MusicHub test fixture`; there are no personal names or personal data.
- **Sustain pedal on the lower staff (O3):** in the piano fixture, sustain pedal events appear only on the lower (left-hand) staff. This is a fixture convention, not an MHD validation rule: the validator accepts pedal events on any keyboard staff.
- **Unambiguous navigation (O4):** in the band fixture, the segno and the coda are outside the repeat section, and the D.S. jump never lands inside an active repeat.
- **Excluded edge case (O5):** the pattern `|:1. A |1. B :|2. C|` (a repeat whose first bar is already inside ending 1) is not used. The current validator reports `alternate-ending-without-repeat` for it.
- **Ids:** element ids are readable 12-character base62 strings with a per-fixture prefix (`GA…`, `PB…`, `BC…`, `NS…`); document ids are fixed lowercase UUIDv7 values.
- **Formatting:** files are formatted with Prettier (`pnpm format`).

## Sidecars

Each `<name>.mhd.json` has a `<name>.expected.json` with only deterministic validation results and structural counts:

```json
{
  "fixture": "<name>.mhd.json",
  "schemaVersion": 1,
  "validation": { "valid": true, "issueCodes": [] },
  "counts": {
    "tracks": 0,
    "staves": 0,
    "masterBars": 0,
    "voices": 0,
    "beats": 0,
    "rests": 0,
    "notes": 0,
    "graceBeats": 0,
    "tiedNotes": 0,
    "sustainPedalEvents": 0
  }
}
```

The format is checked by a strict Zod schema (`src/test-support/fixture-stats.ts`): unknown keys are rejected.

Counting rules (`countStructure`), always on the stored structure, never on derived playback events. An absent field counts as zero.

| Count | Definition |
|---|---|
| `tracks` | Entries in `tracks` |
| `staves` | Staves across all tracks |
| `masterBars` | Entries in `masterBars` |
| `voices` | Voice entries across all staves and bars |
| `beats` | Beat entries across all voices |
| `rests` | Beats with `rest: true` |
| `notes` | Note entries across all beats |
| `graceBeats` | Beats with `grace` set |
| `tiedNotes` | Notes taking part in a tie: each `tiedFromPrevious` note plus the note it continues (previous beat of the same voice, same string and fret on stringed staves, same pitch otherwise). Each note is counted once |
| `sustainPedalEvents` | `sustainPedal` entries across all staves and bars |

**Not in the sidecars:** playback order, repeat expansion, timeline, ticks or milliseconds, and any alphaTab data. The timeline that computes them belongs to Phase 1; these expectations are added once it exists.

## Tests

`src/fixtures.test.ts` imports the fixtures and sidecars as JSON modules (`with { type: 'json' }`), validates each fixture as `unknown`, checks the sidecar schema, the recorded validation result and the counts, and runs negative mutations on in-memory copies (asserting issue code and path). The canonical files are never modified by the tests.

Run them with the package tests:

```bash
pnpm --filter @musichub/music-model test
```
