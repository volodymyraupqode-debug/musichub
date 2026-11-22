# @musichub/music-model — MHD v1

The MusicHub Document (MHD) is the only persisted music format (ADR-0002). This package holds its Zod schemas, TypeScript types, ids, validation and JSON Schema. The full specification is MUSIC_ENGINE.md §3; this file covers how the package implements it. Pure TypeScript: no DOM, React or alphaTab.

## Structure

```
MhdDocument  format 'musichub', schemaVersion 1, id, meta, masterBars[1..5000], tracks[1..64], extensions?
├─ MasterBar   bar data shared by all tracks: time/key signature, tempo changes, repeats, endings, section, direction
└─ Track       name, color (track.1…track.12), instrument, mixer, staves[1..]
   └─ Staff    display, stringed? (tuning, capo, fretCount), transpositionPitch?, hand?, bars[one per master bar]
      └─ Bar   clef?, ottava?, sustainPedal?, voices[1..4]
         └─ Voice → Beat (duration, rest, notes, grace, dynamic, effects, text, lyrics) → Note
```

- A chord is several notes in one beat. Chord diagrams (`chordId`, `Track.chords`) are not part of v1.
- A note has exactly one pitch authority: `string` + `fret` on stringed staves (pitch is derived from tuning and capo), `pitch` (MIDI 0–127) otherwise. Percussion notes use `pitch` as the General MIDI percussion key; there is no alphaTab articulation index.
- Hands and the sustain pedal exist only on keyboard tracks (`KEYBOARD_FAMILIES`, currently `piano`), with one or two staves.

## Time

- `PPQ = 960`. Durations are rhythmic values `{ value, dots, tuplet? }`; ticks and milliseconds are always derived, never stored.
- Positions inside a bar (tempo changes, pedal) are reduced fractions `[numerator, denominator]` in `[0, 1)`. Zero is `[0, 1]`; `[2, 4]` is rejected because `[1, 2]` is the only spelling.
- Tempo is in quarter notes per minute, 20–400. Bar 0 defines time signature, key signature and a tempo at `[0, 1]`; later bars store only changes. Playback speed is a session setting, not document data.
- Repeats, endings and directions are stored as written. The expanded playback order is derived (timeline, Phase 1).

## Stored vs derived

Stored: structure, notes, rhythmic values, mixer, metadata, `extensions`. Never stored: ticks, milliseconds, sounding pitch of stringed notes, playback order, `NoteEvent`s, `DerivedMeta`, alphaTab objects and ids.

## Ids

`generateId()` returns 12 base62 characters from `crypto.getRandomValues` (rejection sampling, no modulo bias, no `Math.random`). Ids are unique within a document, never derived from positions and unchanged by edits or moves; import, copy and paste create new ones. Where Web Crypto is missing (React Native without a polyfill), use `createIdGenerator(source)` with a platform source. `isMhdId()` checks the format.

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

| # | Invariant | Codes |
|---|---|---|
| 1 | Ids are unique in the document | `duplicate-id` |
| 2 | Every staff has one bar per master bar | `bar-count-mismatch` |
| 3 | Voices may be incomplete (warning), never overfull. Grace beats take no time; empty secondary voices and a pickup bar 0 are not incomplete | `voice-overfull`, `voice-incomplete` |
| 4 | Stringed notes: string ∈ [1, strings], fret ∈ [0, fretCount], one note per string per beat; capo ≤ fretCount; one pitch authority | `string-out-of-range`, `fret-out-of-range`, `duplicate-string-in-beat`, `capo-out-of-range`, `note-pitch-missing`, `note-pitch-conflict` |
| 5 | A rest has no notes | `rest-with-notes` |
| 6 | A tie needs the same pitch in the previous beat of the same voice (also across the bar line) | `tie-without-origin` |
| 7 | Repeats are not nested; jump directions have their targets (segno, to coda + coda, fine) | `repeat-start-nested`, `direction-target-missing` |
| 8 | Bar 0 defines time signature, key signature and tempo at `[0, 1]`; later bars only changes; pickup only on bar 0 | `first-bar-*-missing`, `redundant-time-signature`, `redundant-key-signature`, `anacrusis-not-first-bar` |
| 9 | Alternate endings belong to the repeat closed in their group; numbers are unique and ≤ its count | `alternate-ending-*` |
| 10 | Hands and sustain pedal only on keyboard tracks; a keyboard track has 1–2 staves | `keyboard-only-hand`, `keyboard-only-pedal`, `keyboard-staff-count` |
| 11 | Tempo and pedal positions strictly increase; pedal alternates down/up (a pedal may stay down to the end) | `positions-not-increasing`, `pedal-sequence-invalid` |
| 12 | Ties on stringed staves keep string and fret | `tie-string-fret-mismatch` |
| 13 | Percussion notes have no string or fret | `percussion-note-with-string` |

`validateDocument` is pure: it does not mutate the input, generate ids, normalise data or touch `extensions`.

## JSON Schema

`createMhdJsonSchema()` generates a draft 2020-12 schema with Zod's built-in `z.toJSONSchema`. The committed copy `json-schema/mhd-v1.schema.json` is checked by a test (`toMatchFileSnapshot`); run `pnpm --filter @musichub/music-model test -u` after an intended schema change.

Limits: JSON Schema cannot express Zod refinements or cross-field rules. It therefore **accepts** documents that `validateDocument` rejects: non-reduced or ≥ 1 positions (`[2, 4]`, `[1, 1]`) and every invariant in the table above. Use it as an envelope check for non-TS consumers; the authority is `validateDocument`. The test suite asserts strictness, references and determinism, but does not validate the schema against the JSON Schema meta-schema (that needs a validator library, not approved yet).

## Versioning

`schemaVersion` is an integer. A change that is not purely additive increments it and adds a migration (`migrations/vN_to_vN+1`, not implemented in v1). Golden fixtures per version live in `fixtures/v<N>/` (v1 fixtures arrive in S2-03).
