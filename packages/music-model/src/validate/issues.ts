/** Stable issue codes of `validateDocument`. Schema issues use `schema.<zod issue code>`. */
export const ISSUE_CODES = {
  unsupportedSchemaVersion: 'unsupported-schema-version',
  // Invariant 1
  duplicateId: 'duplicate-id',
  // Invariant 2
  barCountMismatch: 'bar-count-mismatch',
  // Invariant 3
  voiceOverfull: 'voice-overfull',
  voiceIncomplete: 'voice-incomplete',
  // Invariant 4 and the single pitch authority of a note
  stringOutOfRange: 'string-out-of-range',
  fretOutOfRange: 'fret-out-of-range',
  duplicateStringInBeat: 'duplicate-string-in-beat',
  capoOutOfRange: 'capo-out-of-range',
  notePitchMissing: 'note-pitch-missing',
  notePitchConflict: 'note-pitch-conflict',
  // Invariant 5
  restWithNotes: 'rest-with-notes',
  beatWithoutNotes: 'beat-without-notes',
  // Invariants 6 and 12
  tieWithoutOrigin: 'tie-without-origin',
  tieStringFretMismatch: 'tie-string-fret-mismatch',
  // Invariant 7
  repeatStartNested: 'repeat-start-nested',
  directionTargetMissing: 'direction-target-missing',
  // Invariant 8
  firstBarTimeSignatureMissing: 'first-bar-time-signature-missing',
  firstBarKeySignatureMissing: 'first-bar-key-signature-missing',
  firstBarTempoMissing: 'first-bar-tempo-missing',
  redundantTimeSignature: 'redundant-time-signature',
  redundantKeySignature: 'redundant-key-signature',
  anacrusisNotFirstBar: 'anacrusis-not-first-bar',
  // Invariant 9
  alternateEndingWithoutRepeat: 'alternate-ending-without-repeat',
  alternateEndingExceedsCount: 'alternate-ending-exceeds-count',
  alternateEndingDuplicate: 'alternate-ending-duplicate',
  alternateEndingCountMismatch: 'alternate-ending-count-mismatch',
  // Invariant 10
  keyboardOnlyHand: 'keyboard-only-hand',
  keyboardOnlyPedal: 'keyboard-only-pedal',
  keyboardStaffCount: 'keyboard-staff-count',
  // Invariant 11
  positionsNotIncreasing: 'positions-not-increasing',
  pedalSequenceInvalid: 'pedal-sequence-invalid',
  // Invariant 13
  percussionNoteWithString: 'percussion-note-with-string',
  // Instrument and effect rules
  drumsNotPercussion: 'drums-not-percussion',
  drumArticulationPitchMismatch: 'drum-articulation-pitch-mismatch',
  drumArticulationNotPercussion: 'drum-articulation-not-percussion',
  brushLongerThanBeat: 'brush-longer-than-beat',
} as const;

export type IssueCode = (typeof ISSUE_CODES)[keyof typeof ISSUE_CODES] | `schema.${string}`;

export type IssueSeverity = 'error' | 'warning';

export type IssuePath = readonly (string | number)[];

export type ValidationIssue = {
  code: IssueCode;
  /** Location in the document, e.g. `['tracks', 0, 'staves', 0, 'bars', 2]`. */
  path: IssuePath;
  message: string;
  severity: IssueSeverity;
};
