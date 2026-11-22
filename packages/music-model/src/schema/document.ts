/**
 * Zod schemas of the MusicHub Document (MHD) v1 (MUSIC_ENGINE.md §3.2).
 *
 * Every object is strict: an unknown key is an error. Extension data lives only in
 * `MhdDocument.extensions`. Rules that need more than one field (bar counts, ties, repeats,
 * instrument limits, …) are checked by `validateDocument`, not here.
 */
import { z } from 'zod';
import { MHD_FORMAT, MHD_SCHEMA_VERSION } from '../constants.js';
import { MHD_ID_PATTERN } from '../ids/id.js';

// ── Primitives ───────────────────────────────────────────────────────────────

export const MhdIdSchema = z
  .string()
  .regex(MHD_ID_PATTERN, 'Expected a 12-character base62 MHD id')
  .meta({ id: 'MhdId' });

/** Lowercase RFC 9562 UUID version 7, the form PostgreSQL and Laravel `Str::uuid7()` produce. */
export const DOCUMENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Id of the whole document: the composition id (UUIDv7, DATABASE.md §1) once synced, a
 * client-generated UUIDv7 before. Element ids inside the document use `MhdIdSchema`.
 */
export const DocumentIdSchema = z
  .string()
  .regex(DOCUMENT_ID_PATTERN, 'Expected a lowercase UUIDv7 document id')
  .meta({ id: 'DocumentId' });

/**
 * Optional flag. Only `true` or an absent key: `false` would be a second spelling of the
 * same state, so it is rejected. Required booleans (`rest`, `mute`, …) keep `true`/`false`.
 */
const flag = z.literal(true).optional();

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

/**
 * Position inside a bar as a reduced fraction `[numerator, denominator]` of the bar length,
 * in `[0, 1)`. Zero is `[0, 1]`. Other spellings of the same value (e.g. `[2, 4]`) are rejected.
 */
export const PositionSchema = z
  .tuple([z.int().min(0), z.int().min(1)])
  .refine(([numerator, denominator]) => numerator < denominator, {
    message: 'Position must be in [0, 1)',
  })
  .refine(([numerator, denominator]) => greatestCommonDivisor(numerator, denominator) === 1, {
    message: 'Position must be a reduced fraction (zero is [0, 1])',
  })
  .meta({ id: 'Position' });

const shortText = z.string().min(1).max(200);
const label = z.string().min(1).max(100);

// ── Document metadata ────────────────────────────────────────────────────────

export const MetaSchema = z
  .strictObject({
    title: shortText,
    subtitle: shortText.optional(),
    artist: shortText.optional(),
    album: shortText.optional(),
    composer: shortText.optional(),
    lyricist: shortText.optional(),
    transcriber: shortText.optional(),
    copyright: shortText.optional(),
    notes: z.string().min(1).max(10_000).optional(),
  })
  .meta({ id: 'Meta' });

// ── Master bars (bar data shared by all tracks) ─────────────────────────────

export const TimeSignatureSchema = z
  .strictObject({
    numerator: z.int().min(1).max(32),
    denominator: z.literal([1, 2, 4, 8, 16, 32]),
  })
  .meta({ id: 'TimeSignature' });

export const KeySignatureSchema = z
  .strictObject({
    fifths: z.int().min(-7).max(7),
    mode: z.enum(['major', 'minor']),
  })
  .meta({ id: 'KeySignature' });

/** Tempo in quarter notes per minute. Playback speed is a session setting and never stored. */
export const TempoChangeSchema = z
  .strictObject({
    position: PositionSchema,
    bpm: z.number().min(20).max(400),
    label: label.optional(),
  })
  .meta({ id: 'TempoChange' });

export const DIRECTIONS = [
  'segno',
  'segnoSegno',
  'coda',
  'doubleCoda',
  'fine',
  'daCapo',
  'daCapoAlFine',
  'daCapoAlCoda',
  'dalSegno',
  'dalSegnoAlFine',
  'dalSegnoAlCoda',
  'toCoda',
] as const;

/**
 * Highest repeat count and alternate ending number. An MHD sanity limit, not an engine limit;
 * engine-specific limits are handled by the adapter in music-engine.
 */
export const MAX_REPEAT_COUNT = 99;

export const MasterBarSchema = z
  .strictObject({
    id: MhdIdSchema,
    timeSignature: TimeSignatureSchema.optional(),
    keySignature: KeySignatureSchema.optional(),
    tempoChanges: z.array(TempoChangeSchema).min(1).optional(),
    tripletFeel: z
      .enum(['none', '8th', '16th', 'dotted8th', 'dotted16th', 'scottish8th', 'scottish16th'])
      .optional(),
    repeatStart: flag,
    /** `count` is the total number of plays of the repeated section (≥ 2). */
    repeatEnd: z.strictObject({ count: z.int().min(2).max(MAX_REPEAT_COUNT) }).optional(),
    /** Passes (1-based) in which this bar is played, e.g. `[1]` or `[2, 3]`. */
    alternateEndings: z.array(z.int().min(1).max(MAX_REPEAT_COUNT)).min(1).optional(),
    section: z
      .strictObject({ letter: z.string().min(1).max(3).optional(), text: label })
      .optional(),
    direction: z.enum(DIRECTIONS).optional(),
    fermata: flag,
    /** Pickup bar; only allowed on bar 0. */
    isAnacrusis: flag,
  })
  .meta({ id: 'MasterBar' });

// ── Notes and beats ──────────────────────────────────────────────────────────

const fret = z.int().min(0).max(36);

export const BendPointSchema = z
  .strictObject({
    offset: z.int().min(0).max(60),
    /** Quarter tones. */
    value: z.int().min(-24).max(24),
  })
  .meta({ id: 'BendPoint' });

export const NoteEffectsSchema = z
  .strictObject({
    bend: z.array(BendPointSchema).min(1).optional(),
    slideOut: z.enum(['shift', 'legato', 'outUp', 'outDown']).optional(),
    slideIn: z.enum(['intoFromBelow', 'intoFromAbove']).optional(),
    hammerPullOrigin: flag,
    palmMute: flag,
    letRing: flag,
    deadNote: flag,
    ghost: flag,
    staccato: flag,
    accent: z.enum(['normal', 'heavy']).optional(),
    harmonic: z
      .strictObject({
        type: z.enum(['natural', 'artificial', 'pinch', 'tap', 'semi', 'feedback']),
        fret: z.number().min(0).max(36).optional(),
      })
      .optional(),
    vibrato: z.enum(['slight', 'wide']).optional(),
    trill: z.strictObject({ fret, speed: z.literal([16, 32, 64]) }).optional(),
    fingering: z
      .strictObject({
        left: z.int().min(0).max(5).optional(),
        right: z.enum(['p', 'i', 'm', 'a', 'c']).optional(),
      })
      .optional(),
  })
  .meta({ id: 'NoteEffects' });

/**
 * Playing techniques of a percussion note and the General MIDI percussion keys each one
 * applies to. The note's `pitch` (GM key) always selects the instrument and sound; a technique
 * only adds what GM has no key for (closed hi-hat is 42, open 46, ride bell 53, …: no technique
 * needed). One technique works for every listed instrument, e.g. `choke` on crash 1/2, china
 * and splash. The vocabulary is MusicHub's own; mapping to engines lives in music-engine.
 */
export const DRUM_TECHNIQUES = {
  halfOpen: [42, 46],
  rimshot: [38, 40],
  edge: [51, 59],
  choke: [49, 52, 55, 57],
} as const satisfies Record<string, readonly number[]>;

export type DrumTechnique = keyof typeof DRUM_TECHNIQUES;

const drumTechniqueIds = Object.keys(DRUM_TECHNIQUES) as [DrumTechnique, ...DrumTechnique[]];

/**
 * One pitch. Exactly one pitch authority (checked by `validateDocument`):
 * `string` + `fret` on stringed staves (pitch is derived from tuning and capo), otherwise
 * `pitch`. On percussion tracks `pitch` is the General MIDI percussion key.
 */
export const NoteSchema = z
  .strictObject({
    id: MhdIdSchema,
    /** 1 = highest string. */
    string: z.int().min(1).max(10).optional(),
    fret: fret.optional(),
    /** MIDI pitch 0–127. */
    pitch: z.int().min(0).max(127).optional(),
    spelling: z
      .strictObject({
        step: z.enum(['C', 'D', 'E', 'F', 'G', 'A', 'B']),
        alter: z.int().min(-2).max(2),
      })
      .optional(),
    velocity: z.int().min(1).max(127).optional(),
    hand: z.enum(['left', 'right']).optional(),
    /** Tie destination: continues a note of the previous beat in the same voice. */
    tiedFromPrevious: flag,
    /** Percussion tracks only; must be allowed for `pitch` (`DRUM_TECHNIQUES`). */
    drumTechnique: z.enum(drumTechniqueIds).optional(),
    effects: NoteEffectsSchema.optional(),
  })
  .meta({ id: 'Note' });

export const DURATION_VALUES = [1, 2, 4, 8, 16, 32, 64, 128] as const;

export const DurationSchema = z
  .strictObject({
    value: z.literal(DURATION_VALUES),
    dots: z.literal([0, 1, 2]),
    tuplet: z
      .strictObject({ actual: z.int().min(2).max(15), normal: z.int().min(1).max(15) })
      .optional(),
  })
  .meta({ id: 'Duration' });

export const BeatEffectsSchema = z
  .strictObject({
    vibrato: z.enum(['slight', 'wide']).optional(),
    tremoloPicking: z.literal([8, 16, 32]).optional(),
    pickStroke: z.enum(['up', 'down']).optional(),
    /** Strum; `duration` is the rhythmic span of the strum, absent = engine default. */
    brush: z
      .strictObject({ direction: z.enum(['up', 'down']), duration: DurationSchema.optional() })
      .optional(),
    tap: flag,
    slap: flag,
    pop: flag,
    fadeIn: flag,
    whammy: z.array(BendPointSchema).min(1).optional(),
    crescendo: z.enum(['crescendo', 'decrescendo']).optional(),
  })
  .meta({ id: 'BeatEffects' });

/** A group of simultaneous notes with one rhythmic value. A chord is several notes in one beat. */
export const BeatSchema = z
  .strictObject({
    id: MhdIdSchema,
    duration: DurationSchema,
    rest: z.boolean(),
    notes: z.array(NoteSchema),
    grace: z.enum(['beforeBeat', 'onBeat']).optional(),
    dynamic: z.enum(['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff']).optional(),
    text: shortText.optional(),
    lyrics: z.array(z.string().max(200)).min(1).optional(),
    effects: BeatEffectsSchema.optional(),
  })
  .meta({ id: 'Beat' });

export const VoiceSchema = z
  .strictObject({ id: MhdIdSchema, beats: z.array(BeatSchema) })
  .meta({ id: 'Voice' });

export const SustainPedalSchema = z
  .strictObject({ position: PositionSchema, type: z.enum(['down', 'up']) })
  .meta({ id: 'SustainPedal' });

export const BarSchema = z
  .strictObject({
    id: MhdIdSchema,
    clef: z.enum(['G2', 'F4', 'C3', 'C4', 'neutral']).optional(),
    ottava: z.enum(['15ma', '8va', '8vb', '15mb']).optional(),
    /** Keyboard staves only. */
    sustainPedal: z.array(SustainPedalSchema).min(1).optional(),
    /** 1–4 voices; voice 0 is the primary voice. */
    voices: z.array(VoiceSchema).min(1).max(4),
  })
  .meta({ id: 'Bar' });

// ── Tracks and staves ────────────────────────────────────────────────────────

export const StaffSchema = z
  .strictObject({
    id: MhdIdSchema,
    display: z.strictObject({
      standard: z.boolean(),
      tab: z.boolean(),
      slash: z.boolean(),
      numbered: z.boolean(),
    }),
    stringed: z
      .strictObject({
        /** MIDI pitches, highest string first. */
        tuning: z.array(z.int().min(0).max(127)).min(4).max(10),
        capo: fret,
        fretCount: z.int().min(1).max(36),
      })
      .optional(),
    /** Written-to-sounding transposition in semitones, e.g. -12 for guitar. */
    transpositionPitch: z.int().min(-48).max(48).optional(),
    /** Keyboard staves only. Default for a 2-staff keyboard track: upper = right, lower = left. */
    hand: z.enum(['left', 'right']).optional(),
    /** One bar per master bar. */
    bars: z.array(BarSchema),
  })
  .meta({ id: 'Staff' });

export const INSTRUMENT_FAMILIES = [
  'guitar',
  'bass',
  'piano',
  'drums',
  'vocals',
  'strings',
  'brass',
  'woodwinds',
  'synth',
  'other',
] as const;

/** Families whose tracks may use hands and the sustain pedal (keyboard tracks). */
export const KEYBOARD_FAMILIES: readonly (typeof INSTRUMENT_FAMILIES)[number][] = [
  'piano',
  'synth',
];

export const TRACK_COLORS = [
  'track.1',
  'track.2',
  'track.3',
  'track.4',
  'track.5',
  'track.6',
  'track.7',
  'track.8',
  'track.9',
  'track.10',
  'track.11',
  'track.12',
] as const;

export const TrackSchema = z
  .strictObject({
    id: MhdIdSchema,
    name: label,
    shortName: z.string().min(1).max(20).optional(),
    /** Design-token palette id `track.1` … `track.12` (DESIGN_SYSTEM.md), never a hex colour. */
    color: z.enum(TRACK_COLORS),
    instrument: z.strictObject({
      family: z.enum(INSTRUMENT_FAMILIES),
      midiProgram: z.int().min(0).max(127),
      bank: z.int().min(0).max(16_383).optional(),
      percussion: z.boolean(),
    }),
    mixer: z.strictObject({
      volume: z.number().min(0).max(1),
      pan: z.number().min(-1).max(1),
      mute: z.boolean(),
      solo: z.boolean(),
    }),
    staves: z.array(StaffSchema).min(1),
  })
  .meta({ id: 'Track' });

// ── Document ─────────────────────────────────────────────────────────────────

/** `vendor.name`, e.g. `alphatab.unmapped`. */
export const EXTENSION_KEY_PATTERN = /^[a-z][a-z0-9-]*\.[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** JSON-compatible extension data, preserved verbatim by every client. */
export const ExtensionsSchema = z
  .record(
    z.string().regex(EXTENSION_KEY_PATTERN, 'Extension keys use the form vendor.name'),
    z.json().meta({ id: 'JsonValue' }),
  )
  .meta({ id: 'Extensions' });

/** Limits shared with the API (API.md §5). */
export const MAX_TRACKS = 64;
export const MAX_MASTER_BARS = 5000;

export const MhdDocumentSchema = z
  .strictObject({
    format: z.literal(MHD_FORMAT),
    schemaVersion: z.literal(MHD_SCHEMA_VERSION),
    id: DocumentIdSchema,
    meta: MetaSchema,
    masterBars: z.array(MasterBarSchema).min(1).max(MAX_MASTER_BARS),
    tracks: z.array(TrackSchema).min(1).max(MAX_TRACKS),
    extensions: ExtensionsSchema.optional(),
  })
  .meta({ id: 'MhdDocument', title: 'MusicHub Document (MHD) v1' });

export type MhdDocument = z.infer<typeof MhdDocumentSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type MasterBar = z.infer<typeof MasterBarSchema>;
export type TimeSignature = z.infer<typeof TimeSignatureSchema>;
export type KeySignature = z.infer<typeof KeySignatureSchema>;
export type TempoChange = z.infer<typeof TempoChangeSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type InstrumentFamily = (typeof INSTRUMENT_FAMILIES)[number];
export type Staff = z.infer<typeof StaffSchema>;
export type Bar = z.infer<typeof BarSchema>;
export type SustainPedal = z.infer<typeof SustainPedalSchema>;
export type Voice = z.infer<typeof VoiceSchema>;
export type Beat = z.infer<typeof BeatSchema>;
export type Duration = z.infer<typeof DurationSchema>;
export type Note = z.infer<typeof NoteSchema>;
export type BendPoint = z.infer<typeof BendPointSchema>;
export type Extensions = z.infer<typeof ExtensionsSchema>;
