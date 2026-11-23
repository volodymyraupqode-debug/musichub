import { MHD_SCHEMA_VERSION } from '../constants.js';
import {
  DRUM_TECHNIQUES,
  KEYBOARD_FAMILIES,
  MhdDocumentSchema,
  type Beat,
  type MasterBar,
  type MhdDocument,
  type Note,
  type Position,
  type Staff,
  type TimeSignature,
  type Track,
} from '../schema/document.js';
import { ISSUE_CODES, type IssueCode, type IssuePath, type ValidationIssue } from './issues.js';
import {
  ZERO,
  add,
  barTicks,
  compare,
  durationTicks,
  rational,
  type Rational,
} from './rational.js';

export type ValidationResult = {
  /** True when there is no issue with severity `error`. Warnings do not make a document invalid. */
  valid: boolean;
  issues: ValidationIssue[];
  /** The parsed document when the structure matches the schema (cross-field errors may still exist). */
  document?: MhdDocument;
};

/**
 * Validates an MHD v1 document: structure (Zod schema), then the cross-field invariants of
 * MUSIC_ENGINE.md §3.3. Pure: it never mutates the input, generates ids or normalises data.
 * Cross-field checks run only when the structure is valid.
 */
export function validateDocument(input: unknown): ValidationResult {
  const tooNew = checkSchemaVersion(input);
  if (tooNew) return { valid: false, issues: [tooNew] };

  const parsed = MhdDocumentSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue): ValidationIssue => ({
      code: `schema.${issue.code}`,
      path: issue.path.map((segment) => (typeof segment === 'symbol' ? String(segment) : segment)),
      message: issue.message,
      severity: 'error',
    }));
    return { valid: false, issues };
  }

  const issues = new Collector();
  checkDocument(parsed.data, issues);
  return {
    valid: !issues.list.some((issue) => issue.severity === 'error'),
    issues: issues.list,
    document: parsed.data,
  };
}

function checkSchemaVersion(input: unknown): ValidationIssue | undefined {
  if (typeof input !== 'object' || input === null || !('schemaVersion' in input)) return undefined;
  const version = input.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version <= MHD_SCHEMA_VERSION) {
    return undefined;
  }
  return {
    code: ISSUE_CODES.unsupportedSchemaVersion,
    path: ['schemaVersion'],
    message: `Document schema version ${version} is newer than supported version ${MHD_SCHEMA_VERSION}. Update MusicHub to open it.`,
    severity: 'error',
  };
}

class Collector {
  readonly list: ValidationIssue[] = [];

  error(code: IssueCode, path: IssuePath, message: string): void {
    this.list.push({ code, path, message, severity: 'error' });
  }

  warning(code: IssueCode, path: IssuePath, message: string): void {
    this.list.push({ code, path, message, severity: 'warning' });
  }
}

function checkDocument(doc: MhdDocument, issues: Collector): void {
  checkUniqueIds(doc, issues);
  checkMasterBars(doc.masterBars, issues);
  const timeSignatures = effectiveTimeSignatures(doc.masterBars);
  doc.tracks.forEach((track, trackIndex) => {
    checkTrack(doc, track, ['tracks', trackIndex], timeSignatures, issues);
  });
  checkFermataOnsets(doc, timeSignatures, issues);
}

// ── Invariant 1: unique ids ──────────────────────────────────────────────────

function checkUniqueIds(doc: MhdDocument, issues: Collector): void {
  const seen = new Map<string, IssuePath>();
  const visit = (id: string, path: IssuePath): void => {
    const first = seen.get(id);
    if (first) {
      issues.error(
        ISSUE_CODES.duplicateId,
        path,
        `Id "${id}" is already used at ${first.join('.')}`,
      );
    } else {
      seen.set(id, path);
    }
  };
  visit(doc.id, ['id']);
  doc.masterBars.forEach((bar, index) => visit(bar.id, ['masterBars', index, 'id']));
  doc.tracks.forEach((track, t) => {
    visit(track.id, ['tracks', t, 'id']);
    track.staves.forEach((staff, s) => {
      const staffPath = ['tracks', t, 'staves', s];
      visit(staff.id, [...staffPath, 'id']);
      staff.bars.forEach((bar, b) => {
        const barPath = [...staffPath, 'bars', b];
        visit(bar.id, [...barPath, 'id']);
        bar.voices.forEach((voice, v) => {
          const voicePath = [...barPath, 'voices', v];
          visit(voice.id, [...voicePath, 'id']);
          voice.beats.forEach((beat, bt) => {
            const beatPath = [...voicePath, 'beats', bt];
            visit(beat.id, [...beatPath, 'id']);
            beat.notes.forEach((note, n) => visit(note.id, [...beatPath, 'notes', n, 'id']));
          });
        });
      });
    });
  });
}

// ── Master bars: invariants 7, 8, 9, 11 ──────────────────────────────────────

function checkMasterBars(masterBars: readonly MasterBar[], issues: Collector): void {
  checkFirstBar(masterBars, issues);
  checkRedundantSignatures(masterBars, issues);
  masterBars.forEach((bar, index) => {
    if (bar.isAnacrusis === true && index !== 0) {
      issues.error(
        ISSUE_CODES.anacrusisNotFirstBar,
        ['masterBars', index, 'isAnacrusis'],
        'Only bar 0 can be a pickup bar',
      );
    }
    if (bar.tempoChanges) {
      checkIncreasing(
        bar.tempoChanges.map((change) => change.position),
        ['masterBars', index, 'tempoChanges'],
        issues,
      );
    }
    if (bar.fermatas) {
      checkIncreasing(
        bar.fermatas.map((fermata) => fermata.position),
        ['masterBars', index, 'fermatas'],
        issues,
      );
    }
  });
  checkRepeats(masterBars, issues);
  checkAlternateEndings(masterBars, issues);
  checkDirections(masterBars, issues);
}

function checkFirstBar(masterBars: readonly MasterBar[], issues: Collector): void {
  const first = masterBars[0];
  if (!first) return;
  const path = ['masterBars', 0];
  if (!first.timeSignature) {
    issues.error(
      ISSUE_CODES.firstBarTimeSignatureMissing,
      [...path, 'timeSignature'],
      'Bar 0 must define the time signature',
    );
  }
  if (!first.keySignature) {
    issues.error(
      ISSUE_CODES.firstBarKeySignatureMissing,
      [...path, 'keySignature'],
      'Bar 0 must define the key signature',
    );
  }
  const start = first.tempoChanges?.[0]?.position;
  if (!start || start[0] !== 0) {
    issues.error(
      ISSUE_CODES.firstBarTempoMissing,
      [...path, 'tempoChanges'],
      'Bar 0 must define a tempo at position [0, 1]',
    );
  }
}

/** Later bars carry only changes (invariant 8). */
function checkRedundantSignatures(masterBars: readonly MasterBar[], issues: Collector): void {
  let time = masterBars[0]?.timeSignature;
  let key = masterBars[0]?.keySignature;
  masterBars.forEach((bar, index) => {
    if (index === 0) return;
    if (bar.timeSignature) {
      if (
        time &&
        bar.timeSignature.numerator === time.numerator &&
        bar.timeSignature.denominator === time.denominator
      ) {
        issues.error(
          ISSUE_CODES.redundantTimeSignature,
          ['masterBars', index, 'timeSignature'],
          'Time signature repeats the current one; store only changes',
        );
      }
      time = bar.timeSignature;
    }
    if (bar.keySignature) {
      if (key && bar.keySignature.fifths === key.fifths && bar.keySignature.mode === key.mode) {
        issues.error(
          ISSUE_CODES.redundantKeySignature,
          ['masterBars', index, 'keySignature'],
          'Key signature repeats the current one; store only changes',
        );
      }
      key = bar.keySignature;
    }
  });
}

/** Repeat sections are not nested: a repeat start must be closed before the next one (invariant 7). */
function checkRepeats(masterBars: readonly MasterBar[], issues: Collector): void {
  let openStart: number | undefined;
  masterBars.forEach((bar, index) => {
    if (bar.repeatStart === true) {
      if (openStart !== undefined) {
        issues.error(
          ISSUE_CODES.repeatStartNested,
          ['masterBars', index, 'repeatStart'],
          `Repeat started at bar ${openStart} is not closed before this repeat start`,
        );
      }
      openStart = index;
    }
    if (bar.repeatEnd) openStart = undefined;
  });
}

/**
 * Invariant 9. Consecutive bars with alternate endings form one group (e.g. `|1. … :|2. …|`).
 * A bar that carries an ending and opens the next repeat (`|2. C |: …`) closes the group; a
 * one-bar repeat section with endings (`|:1. A :|`) opens a new one. The group
 * belongs to the repeat closed inside it; ending numbers must not exceed its count. A bracket is
 * a run of consecutive bars with the same ending set (a multi-bar ending); a number may appear
 * in only one bracket of a group.
 */
function checkAlternateEndings(masterBars: readonly MasterBar[], issues: Collector): void {
  for (const group of endingGroups(masterBars)) {
    const closing = group.find(({ bar }) => bar.repeatEnd);
    const count = closing?.bar.repeatEnd?.count;
    const usedIn = new Map<number, string>();
    let previousKey: string | undefined;
    for (const { bar, index } of group) {
      const endings = bar.alternateEndings ?? [];
      const path = ['masterBars', index, 'alternateEndings'];
      const key = [...endings].sort((a, b) => a - b).join(',');
      const sameBracket = key === previousKey;
      previousKey = key;
      if (new Set(endings).size !== endings.length) {
        issues.error(
          ISSUE_CODES.alternateEndingDuplicate,
          path,
          'Alternate ending numbers must be unique',
        );
      } else if (!sameBracket) {
        const reused = endings.filter((ending) => usedIn.has(ending));
        if (reused.length > 0) {
          issues.error(
            ISSUE_CODES.alternateEndingDuplicate,
            path,
            `Alternate endings ${reused.join(', ')} are already used in this ending group`,
          );
        }
        for (const ending of endings) usedIn.set(ending, key);
      }
      if (count === undefined) {
        issues.error(
          ISSUE_CODES.alternateEndingWithoutRepeat,
          path,
          'Alternate endings need a repeat end in the same ending group',
        );
        continue;
      }
      if (bar.repeatEnd && bar.repeatEnd.count !== count) {
        issues.error(
          ISSUE_CODES.alternateEndingCountMismatch,
          ['masterBars', index, 'repeatEnd', 'count'],
          `Repeat ends in one ending group must share the count ${count}`,
        );
      }
      const tooHigh = endings.filter((ending) => ending > count);
      if (tooHigh.length > 0) {
        issues.error(
          ISSUE_CODES.alternateEndingExceedsCount,
          path,
          `Alternate endings ${tooHigh.join(', ')} exceed the repeat count ${count}`,
        );
      }
    }
  }
}

type IndexedBar = { bar: MasterBar; index: number };

function endingGroups(masterBars: readonly MasterBar[]): IndexedBar[][] {
  const groups: IndexedBar[][] = [];
  let current: IndexedBar[] = [];
  const flush = (): void => {
    if (current.length > 0) groups.push(current);
    current = [];
  };
  masterBars.forEach((bar, index) => {
    if (!bar.alternateEndings) {
      flush();
      return;
    }
    // A one-bar repeat section (`|:1. A :|`) opens its own group.
    if (bar.repeatStart === true && bar.repeatEnd) flush();
    current.push({ bar, index });
    // A bar that opens the next repeat (`|2. C |: …`) is the last ending of the current group.
    if (bar.repeatStart === true && !bar.repeatEnd) flush();
  });
  flush();
  return groups;
}

/** Jump directions need their targets (invariant 7). */
function checkDirections(masterBars: readonly MasterBar[], issues: Collector): void {
  const present = new Set(masterBars.map((bar) => bar.direction));
  masterBars.forEach((bar, index) => {
    const direction = bar.direction;
    if (!direction) return;
    const needs: string[] = [];
    if (direction.startsWith('dalSegno')) needs.push('segno');
    if (direction.endsWith('AlCoda')) needs.push('toCoda', 'coda');
    if (direction.endsWith('AlFine')) needs.push('fine');
    if (direction === 'toCoda') needs.push('coda');
    const missing = needs.filter((target) => !present.has(target as MasterBar['direction']));
    if (missing.length > 0) {
      issues.error(
        ISSUE_CODES.directionTargetMissing,
        ['masterBars', index, 'direction'],
        `"${direction}" needs ${missing.join(' and ')} in the score`,
      );
    }
  });
}

function checkIncreasing(positions: readonly Position[], path: IssuePath, issues: Collector): void {
  for (let index = 1; index < positions.length; index += 1) {
    const previous = positions[index - 1];
    const current = positions[index];
    if (previous && current && compare(asRational(current), asRational(previous)) <= 0) {
      issues.error(
        ISSUE_CODES.positionsNotIncreasing,
        [...path, index, 'position'],
        'Positions must be strictly increasing',
      );
    }
  }
}

/**
 * Warning `fermata-not-on-beat`: a fermata position should be the start of a non-grace beat
 * (rests count) in some voice of some staff. Positions are fractions of the nominal bar length of
 * the time signature, also in a pickup bar (same convention as tempo and pedal positions).
 */
function checkFermataOnsets(
  doc: MhdDocument,
  timeSignatures: readonly TimeSignature[],
  issues: Collector,
): void {
  doc.masterBars.forEach((masterBar, barIndex) => {
    const timeSignature = timeSignatures[barIndex];
    if (!masterBar.fermatas || !timeSignature) return;
    const length = barTicks(timeSignature);
    const onsets: Rational[] = [];
    for (const track of doc.tracks) {
      for (const staff of track.staves) {
        for (const voice of staff.bars[barIndex]?.voices ?? []) {
          let start = ZERO;
          for (const beat of voice.beats) {
            if (beat.grace !== undefined) continue;
            // start / length as a reduced fraction of the bar
            onsets.push(
              rational(start.numerator * length.denominator, start.denominator * length.numerator),
            );
            start = add(start, durationTicks(beat.duration));
          }
        }
      }
    }
    masterBar.fermatas.forEach((fermata, fermataIndex) => {
      const position = asRational(fermata.position);
      if (!onsets.some((onset) => compare(onset, position) === 0)) {
        issues.warning(
          ISSUE_CODES.fermataNotOnBeat,
          ['masterBars', barIndex, 'fermatas', fermataIndex, 'position'],
          'No beat of any voice starts at the fermata position',
        );
      }
    });
  });
}

function asRational([numerator, denominator]: Position): Rational {
  return rational(numerator, denominator);
}

function effectiveTimeSignatures(masterBars: readonly MasterBar[]): TimeSignature[] {
  const result: TimeSignature[] = [];
  let current: TimeSignature = { numerator: 4, denominator: 4 };
  for (const bar of masterBars) {
    current = bar.timeSignature ?? current;
    result.push(current);
  }
  return result;
}

// ── Tracks and staves: invariants 2, 3, 4, 5, 6, 10, 11, 12, 13 ─────────────

function isKeyboard(track: Track): boolean {
  return KEYBOARD_FAMILIES.includes(track.instrument.family);
}

function checkTrack(
  doc: MhdDocument,
  track: Track,
  path: IssuePath,
  timeSignatures: readonly TimeSignature[],
  issues: Collector,
): void {
  const keyboard = isKeyboard(track);
  if (track.instrument.family === 'drums' && !track.instrument.percussion) {
    issues.error(
      ISSUE_CODES.drumsNotPercussion,
      [...path, 'instrument', 'percussion'],
      'A drums track must be a percussion track',
    );
  }
  if (keyboard && track.staves.length > 2) {
    issues.error(
      ISSUE_CODES.keyboardStaffCount,
      [...path, 'staves'],
      'A keyboard track has one or two staves',
    );
  }
  track.staves.forEach((staff, staffIndex) => {
    const staffPath = [...path, 'staves', staffIndex];
    if (staff.bars.length !== doc.masterBars.length) {
      issues.error(
        ISSUE_CODES.barCountMismatch,
        [...staffPath, 'bars'],
        `Staff has ${staff.bars.length} bars, the document has ${doc.masterBars.length} master bars`,
      );
    }
    if (staff.hand && !keyboard) {
      issues.error(
        ISSUE_CODES.keyboardOnlyHand,
        [...staffPath, 'hand'],
        'Hands are allowed only on keyboard tracks',
      );
    }
    if (staff.stringed && staff.stringed.capo > staff.stringed.fretCount) {
      issues.error(
        ISSUE_CODES.capoOutOfRange,
        [...staffPath, 'stringed', 'capo'],
        'Capo must be between 0 and fretCount',
      );
    }
    checkPedals(staff, staffPath, keyboard, issues);
    checkBars(doc, track, staff, staffPath, timeSignatures, keyboard, issues);
  });
}

function checkPedals(
  staff: Staff,
  staffPath: IssuePath,
  keyboard: boolean,
  issues: Collector,
): void {
  let down = false;
  staff.bars.forEach((bar, barIndex) => {
    if (!bar.sustainPedal) return;
    const pedalPath = [...staffPath, 'bars', barIndex, 'sustainPedal'];
    if (!keyboard) {
      issues.error(
        ISSUE_CODES.keyboardOnlyPedal,
        pedalPath,
        'The sustain pedal is allowed only on keyboard tracks',
      );
      return;
    }
    checkIncreasing(
      bar.sustainPedal.map((pedal) => pedal.position),
      pedalPath,
      issues,
    );
    bar.sustainPedal.forEach((pedal, index) => {
      if ((pedal.type === 'down') === down) {
        issues.error(
          ISSUE_CODES.pedalSequenceInvalid,
          [...pedalPath, index, 'type'],
          down
            ? 'Pedal down while the pedal is already down'
            : 'Pedal up while the pedal is not down',
        );
      }
      down = pedal.type === 'down';
    });
  });
}

function checkBars(
  doc: MhdDocument,
  track: Track,
  staff: Staff,
  staffPath: IssuePath,
  timeSignatures: readonly TimeSignature[],
  keyboard: boolean,
  issues: Collector,
): void {
  staff.bars.forEach((bar, barIndex) => {
    const barPath = [...staffPath, 'bars', barIndex];
    if (bar.ottava && (track.instrument.percussion || !staff.display.standard)) {
      issues.warning(
        ISSUE_CODES.ottavaNotDisplayed,
        [...barPath, 'ottava'],
        'An ottava is shown only on a non-percussion staff with standard notation',
      );
    }
    const timeSignature = timeSignatures[barIndex];
    const anacrusis = barIndex === 0 && doc.masterBars[0]?.isAnacrusis === true;
    bar.voices.forEach((voice, voiceIndex) => {
      const voicePath = [...barPath, 'voices', voiceIndex];
      if (timeSignature) {
        checkVoiceLength(
          voice.beats,
          voiceIndex,
          voicePath,
          barTicks(timeSignature),
          anacrusis,
          issues,
        );
      }
      voice.beats.forEach((beat, beatIndex) => {
        const beatPath = [...voicePath, 'beats', beatIndex];
        const previous = previousBeat(staff, barIndex, voiceIndex, beatIndex);
        checkBeat(track, staff, beat, previous, beatPath, keyboard, issues);
      });
    });
  });
}

/** Invariant 3. Grace beats take no time of their own; empty secondary voices are allowed. */
function checkVoiceLength(
  beats: readonly Beat[],
  voiceIndex: number,
  path: IssuePath,
  barLength: Rational,
  anacrusis: boolean,
  issues: Collector,
): void {
  const length = beats
    .filter((beat) => beat.grace === undefined)
    .reduce((sum, beat) => add(sum, durationTicks(beat.duration)), ZERO);
  const difference = compare(length, barLength);
  if (difference > 0) {
    issues.error(ISSUE_CODES.voiceOverfull, path, 'Voice is longer than its bar');
  } else if (difference < 0 && !anacrusis && (voiceIndex === 0 || beats.length > 0)) {
    issues.warning(
      ISSUE_CODES.voiceIncomplete,
      path,
      'Voice is shorter than its bar; playback fills it with rests',
    );
  }
}

/** The beat before `beatIndex` in the same voice, continuing into the previous bar of the staff. */
function previousBeat(
  staff: Staff,
  barIndex: number,
  voiceIndex: number,
  beatIndex: number,
): Beat | undefined {
  if (beatIndex > 0) return staff.bars[barIndex]?.voices[voiceIndex]?.beats[beatIndex - 1];
  return staff.bars[barIndex - 1]?.voices[voiceIndex]?.beats.at(-1);
}

function checkBeat(
  track: Track,
  staff: Staff,
  beat: Beat,
  previous: Beat | undefined,
  beatPath: IssuePath,
  keyboard: boolean,
  issues: Collector,
): void {
  if (beat.rest && beat.notes.length > 0) {
    issues.error(ISSUE_CODES.restWithNotes, [...beatPath, 'notes'], 'A rest has no notes');
  }
  if (!beat.rest && beat.notes.length === 0) {
    issues.error(
      ISSUE_CODES.beatWithoutNotes,
      [...beatPath, 'notes'],
      'A beat that is not a rest needs at least one note; use rest: true for silence',
    );
  }
  const brushDuration = beat.effects?.brush?.duration;
  if (brushDuration && compare(durationTicks(brushDuration), durationTicks(beat.duration)) > 0) {
    issues.error(
      ISSUE_CODES.brushLongerThanBeat,
      [...beatPath, 'effects', 'brush', 'duration'],
      'A brush cannot be longer than its beat',
    );
  }
  const usedStrings = new Set<number>();
  beat.notes.forEach((note, noteIndex) => {
    const notePath = [...beatPath, 'notes', noteIndex];
    if (note.hand && !keyboard) {
      issues.error(
        ISSUE_CODES.keyboardOnlyHand,
        [...notePath, 'hand'],
        'Hands are allowed only on keyboard tracks',
      );
    }
    checkPitchAuthority(track, staff, note, notePath, issues);
    if (note.string !== undefined && staff.stringed) {
      if (usedStrings.has(note.string)) {
        issues.error(
          ISSUE_CODES.duplicateStringInBeat,
          [...notePath, 'string'],
          `String ${note.string} is used twice in this beat`,
        );
      }
      usedStrings.add(note.string);
    }
    if (note.tiedFromPrevious === true) checkTie(staff, note, previous, notePath, issues);
  });
}

/** Exactly one pitch authority (MUSIC_ENGINE.md §3.2) plus invariants 4 and 13. */
function checkPitchAuthority(
  track: Track,
  staff: Staff,
  note: Note,
  notePath: IssuePath,
  issues: Collector,
): void {
  const hasFretting = note.string !== undefined || note.fret !== undefined;
  if (track.instrument.percussion) {
    if (hasFretting) {
      issues.error(
        ISSUE_CODES.percussionNoteWithString,
        notePath,
        'Percussion notes use pitch (General MIDI key), not string and fret',
      );
    }
    if (note.pitch === undefined) {
      issues.error(
        ISSUE_CODES.notePitchMissing,
        [...notePath, 'pitch'],
        'Percussion notes need a pitch (General MIDI key)',
      );
    }
    const technique = note.drumTechnique;
    if (technique !== undefined && note.pitch !== undefined) {
      const keys: readonly number[] = DRUM_TECHNIQUES[technique];
      if (!keys.includes(note.pitch)) {
        issues.error(
          ISSUE_CODES.drumTechniquePitchMismatch,
          [...notePath, 'drumTechnique'],
          `Technique "${technique}" applies to General MIDI keys ${keys.join(', ')}, not ${note.pitch}`,
        );
      }
    }
    return;
  }
  if (note.drumTechnique !== undefined) {
    issues.error(
      ISSUE_CODES.drumTechniqueNotPercussion,
      [...notePath, 'drumTechnique'],
      'Drum techniques are allowed only on percussion tracks',
    );
  }
  const stringed = staff.stringed;
  if (!stringed) {
    if (hasFretting) {
      issues.error(
        ISSUE_CODES.notePitchConflict,
        notePath,
        'Notes on a staff without strings use pitch, not string and fret',
      );
    }
    if (note.pitch === undefined) {
      issues.error(ISSUE_CODES.notePitchMissing, [...notePath, 'pitch'], 'Note needs a pitch');
    }
    return;
  }
  if (note.pitch !== undefined) {
    issues.error(
      ISSUE_CODES.notePitchConflict,
      [...notePath, 'pitch'],
      'Stringed notes derive pitch from string and fret; do not store pitch',
    );
  }
  if (note.string === undefined || note.fret === undefined) {
    issues.error(ISSUE_CODES.notePitchMissing, notePath, 'Stringed notes need string and fret');
    return;
  }
  if (note.string > stringed.tuning.length) {
    issues.error(
      ISSUE_CODES.stringOutOfRange,
      [...notePath, 'string'],
      `String must be between 1 and ${stringed.tuning.length}`,
    );
  }
  if (note.fret > stringed.fretCount) {
    issues.error(
      ISSUE_CODES.fretOutOfRange,
      [...notePath, 'fret'],
      `Fret must be between 0 and ${stringed.fretCount}`,
    );
  }
}

function soundingPitch(staff: Staff, note: Note): number | undefined {
  if (!staff.stringed) return note.pitch;
  if (note.string === undefined || note.fret === undefined) return undefined;
  const open = staff.stringed.tuning[note.string - 1];
  return open === undefined ? undefined : open + staff.stringed.capo + note.fret;
}

/** Invariants 6 and 12: a tie continues a note of the previous beat in the same voice. */
function checkTie(
  staff: Staff,
  note: Note,
  previous: Beat | undefined,
  notePath: IssuePath,
  issues: Collector,
): void {
  const path = [...notePath, 'tiedFromPrevious'];
  const candidates = previous?.rest === false ? previous.notes : [];
  if (staff.stringed) {
    if (candidates.some((origin) => origin.string === note.string && origin.fret === note.fret))
      return;
    const pitch = soundingPitch(staff, note);
    if (
      pitch !== undefined &&
      candidates.some((origin) => soundingPitch(staff, origin) === pitch)
    ) {
      issues.error(
        ISSUE_CODES.tieStringFretMismatch,
        path,
        'A tie on a stringed staff must keep the same string and fret',
      );
      return;
    }
  } else if (candidates.some((origin) => origin.pitch === note.pitch)) {
    return;
  }
  issues.error(
    ISSUE_CODES.tieWithoutOrigin,
    path,
    'The previous beat in this voice has no note of the same pitch',
  );
}
