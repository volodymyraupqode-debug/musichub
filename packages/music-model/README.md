# @musichub/music-model — MHD v1

The MusicHub Document (MHD) is the only persisted music format (ADR-0002). This package holds its Zod schemas, TypeScript types, ids, validation and JSON Schema. The full specification is MUSIC_ENGINE.md §3; this file covers how the package implements it. Pure TypeScript: no DOM, React or alphaTab.

## Structure

```
MhdDocument  format 'musichub', schemaVersion 1, id (UUIDv7), meta, masterBars[1..5000], tracks[1..64], extensions?
├─ MasterBar   bar data shared by all tracks: time/key signature, tempo changes, repeats, endings, section, direction, fermatas
└─ Track       name, color (track.1…track.12), instrument, mixer, staves[1..]
   └─ Staff    display, stringed? (tuning, capo, fretCount), transpositionPitch?, hand?, bars[one per master bar]
      └─ Bar   clef?, ottava?, sustainPedal?, voices[1..4]
         └─ Voice → Beat (duration, rest, notes, grace, dynamic, effects, text, lyrics) → Note
```

- A chord is several notes in one beat. Chord diagrams (`chordId`, `Track.chords`) are not part of v1.
- A note has exactly one pitch authority: `string` + `fret` on stringed staves (pitch is derived from tuning and capo), `pitch` (MIDI 0–127) otherwise.
- `rest: true` ⇔ `notes` is empty. A beat that is not a rest has at least one note.
- Optional flags (`repeatStart`, `isAnacrusis`, `tiedFromPrevious`, note and beat effect flags) are `true` or absent; `false` is rejected so every state has one spelling. Required booleans (`rest`, `percussion`, `mute`, `solo`, `display.*`) keep `true`/`false`.
- Keyboard tracks are `piano` and `synth` (`KEYBOARD_FAMILIES`): only they may use `hand` and the sustain pedal, with one or two staves.

### Ottava and fermatas

- **`Bar.ottava`** (`15ma`, `8va`, `8vb`, `15mb`) is an octave line over every beat of every voice of this bar on this staff. It applies to this bar only and is never carried into the next bar (absent = no line); consecutive bars with the same value may be drawn as one line, which is a rendering choice. It is display only: `Note.pitch`, and the pitch derived from string and fret, is always the sounding pitch and is never rewritten; only the written position moves (−12, −24, +12, +24 semitones). It is not a clef ottava: MHD has no clef ottava, a written-octave instrument uses `Staff.transpositionPitch`. On a percussion staff or a staff without standard notation the line cannot be shown (warning `ottava-not-displayed`).
- **`MasterBar.fermatas`** is a list of `{ position, type? }` with at least one entry. A fermata belongs to the master bar and applies to every track and staff at its position. `type` is `short` or `long`; absent means a standard fermata. Positions strictly increase. A fermata is notation: how long playback holds it is decided by the timeline / playback engine and is not stored in MHD.

```json
"fermatas": [{ "position": [1, 4], "type": "short" }, { "position": [3, 4] }]
```

### Percussion

`pitch` is always the General MIDI percussion key and is required; it selects the instrument and sound. `drumTechnique` is optional (`DRUM_TECHNIQUES`) and adds only what GM has no key for. Each technique is allowed for these GM keys:

| Technique  | GM keys                                          |
| ---------- | ------------------------------------------------ |
| `halfOpen` | 42, 46 (hi-hat)                                  |
| `rimshot`  | 38, 40 (snare)                                   |
| `edge`     | 51, 59 (ride 1, ride 2)                          |
| `choke`    | 49, 52, 55, 57 (crash 1, china, splash, crash 2) |

No technique means the plain GM sound: 42 is a closed hi-hat, 46 an open hi-hat, 44 a pedal hi-hat, 37 a side stick, 53 a ride bell. Examples: 42 + `halfOpen` = half-open hi-hat, 38 + `rimshot`, 51 + `edge`, 55 + `choke` = splash choke, 52 + `choke` = china choke. A `drums` track must have `percussion: true`; other families may also be percussion tracks. Mapping to and from alphaTab lives in `music-engine` (MUSIC_ENGINE.md §4.2), never here.

## Time

- `PPQ = 960`. Durations are rhythmic values `{ value, dots, tuplet? }`; ticks and milliseconds are always derived, never stored. The brush duration reuses the same `Duration` (absent = engine default) and may not be longer than its beat.
- Positions inside a bar (tempo changes, pedal, fermatas) are reduced fractions `[numerator, denominator]` in `[0, 1)` of the nominal bar length of the time signature. Zero is `[0, 1]`; `[2, 4]` is rejected because `[1, 2]` is the only spelling. In a pickup bar the same nominal length applies, so only positions inside the actual pickup content can meet a beat.
- Bend and whammy points: `offset` is 0–60 sixtieths of the note duration, `value` is in quarter tones.
- Tempo is in quarter notes per minute, 20–400. Bar 0 defines time signature, key signature and a tempo at `[0, 1]`; later bars store only changes. Playback speed is a session setting, not document data.
- Repeats, endings and directions are stored as written. The expanded playback order is derived (timeline, Phase 1).

## Stored vs derived

Stored: structure, notes, rhythmic values, mixer, metadata, `extensions`. Never stored: ticks, milliseconds, sounding pitch of stringed notes, playback order, `NoteEvent`s, `DerivedMeta`, alphaTab objects and ids.

## Ids

- **Document id:** lowercase UUIDv7 (`DocumentIdSchema`), the composition id once synced (DATABASE.md §1, Laravel `Str::uuid7()`), client-generated before. This package does not generate document ids yet.
- **Element ids:** `generateId()` returns 12 base62 characters from `crypto.getRandomValues` (rejection sampling, no modulo bias, no `Math.random`). They are unique within a document, never derived from positions and unchanged by edits or moves; import, copy and paste create new ones. Where Web Crypto is missing (React Native without a polyfill), `generateId()` throws a clear error; `createIdGenerator(source)` builds a generator over a platform source. `isMhdId()` checks the format.

## Extensions

`extensions` is the only open part of a document: keys `vendor.name` (e.g. `alphatab.unmapped`), JSON values. Every other object is strict: an unknown key is an error, nothing is stripped. Clients preserve extensions verbatim.

## Validation

```ts
import { validateDocument } from '@musichub/music-model';

const { valid, issues, document } = validateDocument(json);
// issues: { code, path, message, severity: 'error' | 'warning' }[]
```

1. A document with a newer `schemaVersion` returns only `unsupported-schema-version` (update hint).
2. The Zod schema checks structure; its issues are reported as `schema.<zod code>`. Cross-field checks run only when the structure is valid.
3. Cross-field invariants (`ISSUE_CODES`):

| #   | Invariant                                                                                                                                                                                                                                                                                                             | Codes                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Element ids are unique in the document                                                                                                                                                                                                                                                                                | `duplicate-id`                                                                                                                           |
| 2   | Every staff has one bar per master bar                                                                                                                                                                                                                                                                                | `bar-count-mismatch`                                                                                                                     |
| 3   | Voices may be incomplete (warning), never overfull. Grace beats take no time; empty secondary voices and a pickup bar 0 are not incomplete                                                                                                                                                                            | `voice-overfull`, `voice-incomplete`                                                                                                     |
| 4   | Stringed notes: string ∈ [1, strings], fret ∈ [0, fretCount], one note per string per beat; capo ≤ fretCount; one pitch authority                                                                                                                                                                                     | `string-out-of-range`, `fret-out-of-range`, `duplicate-string-in-beat`, `capo-out-of-range`, `note-pitch-missing`, `note-pitch-conflict` |
| 5   | Rest ⇔ no notes                                                                                                                                                                                                                                                                                                       | `rest-with-notes`, `beat-without-notes`                                                                                                  |
| 6   | A tie needs the same pitch in the previous beat of the same voice (also across the bar line)                                                                                                                                                                                                                          | `tie-without-origin`                                                                                                                     |
| 7   | Repeats are not nested; a repeat end without a start is allowed; jump targets exist (`dalSegno*` → segno, `*AlCoda` → to coda + coda, `toCoda` → coda, `*AlFine` → fine)                                                                                                                                              | `repeat-start-nested`, `direction-target-missing`                                                                                        |
| 8   | Bar 0 defines time signature, key signature and tempo at `[0, 1]`; repeating the current time or key signature later is an error (tempo is not checked); pickup only on bar 0                                                                                                                                         | `first-bar-*-missing`, `redundant-time-signature`, `redundant-key-signature`, `anacrusis-not-first-bar`                                  |
| 9   | Alternate endings belong to the repeat closed in their group; a bar that opens the next repeat ends the group; numbers are unique in the group and ≤ its count                                                                                                                                                        | `alternate-ending-*`                                                                                                                     |
| 10  | Hands and sustain pedal only on keyboard tracks (`piano`, `synth`); a keyboard track has 1–2 staves                                                                                                                                                                                                                   | `keyboard-only-hand`, `keyboard-only-pedal`, `keyboard-staff-count`                                                                      |
| 11  | Tempo, pedal and fermata positions strictly increase; pedal alternates down/up (a pedal may stay down to the end)                                                                                                                                                                                                     | `positions-not-increasing`, `pedal-sequence-invalid`                                                                                     |
| 12  | Ties on stringed staves keep string and fret                                                                                                                                                                                                                                                                          | `tie-string-fret-mismatch`                                                                                                               |
| 13  | Percussion notes have no string or fret; `drumTechnique` only on percussion tracks, with a GM key allowed for it                                                                                                                                                                                                      | `percussion-note-with-string`, `drum-technique-*`                                                                                        |
| 14  | Every pass before the last of a repeat reaches a played repeat end of its ending group: for each pass 1…count − 1, at least one repeat-end bar of the group has no alternate endings or lists that pass (several repeat ends per group allowed; ADR-0002 A11, A19). Checks pass coverage only, not the playback order | `repeat-pass-without-repeat-end`                                                                                                         |
| 15  | At most one `segno` and one `coda` direction per document (`segnoSegno` and `doubleCoda` are not counted; ADR-0002 A14)                                                                                                                                                                                               | `navigation-marker-duplicate`                                                                                                            |
| —   | A `drums` track has `percussion: true`; a brush is not longer than its beat                                                                                                                                                                                                                                           | `drums-not-percussion`, `brush-longer-than-beat`                                                                                         |
| —   | Warning: no non-grace beat (rests count) of any voice, staff or track starts at a fermata position                                                                                                                                                                                                                    | `fermata-not-on-beat`                                                                                                                    |
| —   | Warning: an ottava on a percussion staff or a staff without standard notation is not shown                                                                                                                                                                                                                            | `ottava-not-displayed`                                                                                                                   |

`validateDocument` is pure: it does not mutate the input, generate ids, normalise data or touch `extensions`.

## Limits

MHD sanity limits, independent of any engine (engine limits are handled by the adapter in `music-engine`):

| Field                        | Limit                                                     |
| ---------------------------- | --------------------------------------------------------- |
| Tracks / master bars         | 1–64 / 1–5000 (shared with the API)                       |
| Time signature               | numerator 1–32, denominator 1, 2, 4, 8, 16, 32            |
| Tempo                        | 20–400 bpm (quarter notes)                                |
| Repeat count / ending number | 2–99 / 1–99                                               |
| Strings / fret / capo        | 4–10 strings, fret 0–36, fretCount 1–36, capo ≤ fretCount |
| Duration                     | value 1–128, dots 0–2, tuplet actual 2–15, normal 1–15    |
| Bend / whammy                | offset 0–60, value ±24 quarter tones                      |
| Transposition                | ±48 semitones                                             |
| MIDI                         | program 0–127, bank 0–16383, pitch 0–127, velocity 1–127  |
| Text                         | title 1–200; other meta fields 1–200; notes 1–10 000      |

## JSON Schema

`createMhdJsonSchema()` generates a draft 2020-12 schema with Zod's built-in `z.toJSONSchema`. The committed copy `json-schema/mhd-v1.schema.json` is checked by a test (`toMatchFileSnapshot`); run `pnpm --filter @musichub/music-model test -u` after an intended schema change.

It contains structure, types, enums (including `drumTechnique`), ranges, required keys, `const: true` for optional flags, the UUIDv7 pattern for the document id and strict objects. It cannot express Zod refinements or cross-field rules, so it **accepts** documents that `validateDocument` rejects: non-reduced or ≥ 1 positions (`[2, 4]`, `[1, 1]`) and every rule in the table above. Use it as an envelope check for non-TS consumers; the authority is `validateDocument`. The tests assert strictness, references, key properties and determinism; they do not validate the schema against the JSON Schema meta-schema (that needs a validator library, not approved yet).

## Fixtures

Canonical MHD v1 fixtures live in `fixtures/v1/` (details: `fixtures/v1/README.md`):

- `guitar-basic.mhd.json`: stringed model, tablature and guitar techniques.
- `piano-grand-staff.mhd.json`: grand staff with hands and the sustain pedal.
- `band-repeats.mhd.json`: four tracks, pickup, repeat with two endings, D.S. al Coda, drum techniques.

Each fixture has a `<name>.expected.json` sidecar with its validation result and structural counts (no playback data). `src/fixtures.test.ts` imports both as JSON modules, requires zero validation issues, compares the counts and runs negative mutations on in-memory copies. Run them with `pnpm --filter @musichub/music-model test`.

## Versioning

`schemaVersion` is an integer. Every change to the schema structure increments it, including a new optional field or enum value: the schemas are strict, so older clients would otherwise reject new documents with a schema error instead of the update prompt (MUSIC_ENGINE.md §3.4). Until the first public release of MHD v1, while no saved documents exist, v1 may still change without a bump. Each version bump adds a migration (`migrations/vN_to_vN+1`, not implemented in v1). Golden fixtures per version live in `fixtures/v<N>/`.
