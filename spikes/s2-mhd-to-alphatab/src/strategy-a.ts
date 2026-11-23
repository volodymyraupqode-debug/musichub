// Strategy A: build the alphaTab model directly from MHD with the public model classes,
// then call `score.finish(settings)` once (spike S2, ROADMAP.md S2-05).
import * as alphaTab from '@coderline/alphatab';
import type { Beat, MhdDocument, Note, Staff, Track } from '@musichub/music-model';
import { createIdMap, type IdMap } from './id-map.ts';
import {
  ACCENT,
  ACCIDENTAL_MODE,
  CLEF,
  DIRECTION,
  DYNAMIC,
  FERMATA_TYPE,
  HARMONIC,
  OTTAVA,
  RIGHT_FINGER,
  SLIDE_IN,
  SLIDE_OUT,
  TREMOLO_MARKS,
  TRIPLET_FEEL,
  VIBRATO,
  alphaTabString,
  channelsFor,
  defaultBrushTicks,
  defaultClef,
  durationTicks,
  endingsMask,
  fermataPlacement,
  leftFinger,
  mixerBalance,
  mixerVolume,
  naturalHarmonicValue,
  KNOWN_ARTICULATION_IDS,
  percussionArticulation,
  positionRatio,
  resolvedKeySignatures,
  resolvedTimeSignatures,
} from './mapping.ts';
import type { Loss } from './losses.ts';

const { model } = alphaTab;

export interface StrategyAResult {
  score: alphaTab.model.Score;
  idMap: IdMap;
  losses: Loss[];
  /** Milliseconds: object construction, and `score.finish(settings)`. */
  timings: { build: number; finish: number };
}

/** Placeholder colours for the MHD palette ids `track.1`…`track.12` (the real tokens live in design-tokens). */
const TRACK_COLOR_HEX = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
  '#06b6d4',
  '#a855f7',
];

export function toAlphaTabDirect(doc: MhdDocument, settings: alphaTab.Settings): StrategyAResult {
  // alphaTab element ids are global static counters and every alphaTex import resets them
  // (Score.resetIds). Load the articulation table first, never in the middle of a build: an import
  // during construction gives later bars duplicate ids and Gp7Exporter then mixes up bars.
  articulationById(0);
  const t0 = performance.now();
  const idMap = createIdMap();
  const losses: Loss[] = [];
  const score = new model.Score();
  score.title = doc.meta.title;
  score.subTitle = doc.meta.subtitle ?? '';
  score.artist = doc.meta.artist ?? '';
  score.album = doc.meta.album ?? '';
  score.music = doc.meta.composer ?? '';
  score.words = doc.meta.lyricist ?? '';
  score.tab = doc.meta.transcriber ?? '';
  score.copyright = doc.meta.copyright ?? '';
  score.notices = doc.meta.notes ?? '';

  const timeSignatures = resolvedTimeSignatures(doc);
  const keySignatures = resolvedKeySignatures(doc);

  doc.masterBars.forEach((mhd, i) => {
    const mb = new model.MasterBar();
    const ts = timeSignatures[i] ?? { numerator: 4, denominator: 4 };
    mb.timeSignatureNumerator = ts.numerator;
    mb.timeSignatureDenominator = ts.denominator;
    if (mhd.isAnacrusis) mb.isAnacrusis = true;
    if (mhd.repeatStart) mb.isRepeatStart = true;
    if (mhd.repeatEnd) mb.repeatCount = mhd.repeatEnd.count;
    if (mhd.alternateEndings) mb.alternateEndings = endingsMask(mhd.alternateEndings);
    if (mhd.tripletFeel) mb.tripletFeel = TRIPLET_FEEL[mhd.tripletFeel];
    if (mhd.section) {
      const section = new model.Section();
      section.marker = mhd.section.letter ?? '';
      section.text = mhd.section.text;
      mb.section = section;
    }
    if (mhd.direction) mb.addDirection(DIRECTION[mhd.direction]);
    for (const tc of mhd.tempoChanges ?? []) {
      const automation = model.Automation.buildTempoAutomation(
        false,
        positionRatio(tc.position),
        tc.bpm,
        2,
      );
      if (tc.label) automation.text = tc.label;
      mb.tempoAutomations.push(automation);
    }
    score.addMasterBar(mb);
    idMap.set(mb, mhd.id);
  });

  const channels = channelsFor(doc);
  doc.tracks.forEach((mhdTrack, trackIndex) => {
    const track = new model.Track();
    track.name = mhdTrack.name;
    track.shortName = mhdTrack.shortName ?? '';
    const colorIndex = Number(mhdTrack.color.slice('track.'.length)) - 1;
    track.color = model.Color.fromJson(TRACK_COLOR_HEX[colorIndex] ?? '#000000') ?? track.color;
    const info = track.playbackInfo;
    info.program = mhdTrack.instrument.midiProgram;
    info.bank = mhdTrack.instrument.bank ?? 0;
    info.volume = mixerVolume(mhdTrack.mixer.volume);
    info.balance = mixerBalance(mhdTrack.mixer.pan);
    info.isMute = mhdTrack.mixer.mute;
    info.isSolo = mhdTrack.mixer.solo;
    const ch = channels[trackIndex] ?? { primary: 0, secondary: 1 };
    info.primaryChannel = ch.primary;
    info.secondaryChannel = ch.secondary;
    score.addTrack(track);
    idMap.set(track, mhdTrack.id);
    track.ensureStaveCount(mhdTrack.staves.length);
    mhdTrack.staves.forEach((mhdStaff, staffIndex) => {
      const staff = track.staves[staffIndex];
      if (!staff) throw new Error('ensureStaveCount did not create the staff');
      buildStaff(mhdTrack, mhdStaff, staffIndex, staff, keySignatures, idMap, losses);
    });
    if (mhdTrack.staves.some((s) => s.hand !== undefined))
      losses.push({
        feature: 'staff.hand',
        id: mhdTrack.id,
        detail: 'no hand concept on alphaTab staves',
      });
  });

  applyFermatas(doc, score, losses);
  const t1 = performance.now();
  score.finish(settings);
  const t2 = performance.now();
  return { score, idMap, losses, timings: { build: t1 - t0, finish: t2 - t1 } };
}

function buildStaff(
  mhdTrack: Track,
  mhdStaff: Staff,
  staffIndex: number,
  staff: alphaTab.model.Staff,
  keySignatures: { fifths: number; mode: 'major' | 'minor' }[],
  idMap: IdMap,
  losses: Loss[],
): void {
  idMap.set(staff, mhdStaff.id);
  staff.showStandardNotation = mhdStaff.display.standard;
  staff.showTablature = mhdStaff.display.tab;
  staff.showSlash = mhdStaff.display.slash;
  staff.showNumbered = mhdStaff.display.numbered;
  staff.isPercussion = mhdTrack.instrument.percussion;
  if (mhdStaff.stringed) {
    staff.stringTuning.tunings = [...mhdStaff.stringed.tuning];
    staff.capo = mhdStaff.stringed.capo;
    losses.push({
      feature: 'staff.stringed.fretCount',
      id: mhdStaff.id,
      detail: 'alphaTab has no fret count',
    });
  } else if (staff.isPercussion) {
    // Same as the alphaTex importer: six drum-tab lines with pitch 0.
    staff.stringTuning.tunings = [0, 0, 0, 0, 0, 0];
  } else {
    staff.stringTuning.tunings = [];
  }
  // MHD transposition is written-to-sounding and display-only: alphaTab `transpositionPitch`
  // would also shift playback, so it maps to `displayTranspositionPitch` (same sign).
  staff.displayTranspositionPitch = mhdStaff.transpositionPitch ?? 0;

  const voiceCount = Math.max(...mhdStaff.bars.map((b) => b.voices.length));
  let clef = defaultClef(mhdTrack, staffIndex);
  let dynamic = 5; // alphaTab default F, carried forward like alphaTex does
  mhdStaff.bars.forEach((mhdBar, barIndex) => {
    const bar = new model.Bar();
    if (mhdBar.clef) clef = mhdBar.clef;
    bar.clef = CLEF[clef];
    // Q-D: Bar.ottava is a display-only octave line on every beat of this bar (Beat.ottava);
    // Bar.clefOttava stays Regular and nothing is carried into the next bar.
    const ottava = OTTAVA[mhdBar.ottava ?? 'regular'];
    const ks = keySignatures[barIndex] ?? { fifths: 0, mode: 'major' };
    bar.keySignature = ks.fifths;
    bar.keySignatureType = ks.mode === 'major' ? 0 : 1;
    for (const pedal of mhdBar.sustainPedal ?? []) {
      const marker = new model.SustainPedalMarker();
      marker.ratioPosition = positionRatio(pedal.position);
      marker.pedalType = pedal.type === 'down' ? 0 : 2;
      bar.sustainPedals.push(marker);
    }
    staff.addBar(bar);
    idMap.set(bar, mhdBar.id);
    for (const mhdVoice of mhdBar.voices) {
      const voice = new model.Voice();
      bar.addVoice(voice);
      idMap.set(voice, mhdVoice.id);
      for (const mhdBeat of mhdVoice.beats) {
        if (mhdBeat.dynamic) dynamic = DYNAMIC[mhdBeat.dynamic];
        const beat = buildBeat(mhdBeat, mhdStaff, staff, dynamic, idMap, losses);
        beat.ottava = ottava;
        voice.addBeat(beat);
      }
      if (mhdVoice.beats.length === 0) appendPlaceholderBeat(voice);
    }
    // finish() chains voice i of a bar to voice i of the next bar and crashes if it is missing,
    // so every bar of a staff needs the same voice count (alphaTab pads with placeholder voices).
    while (bar.voices.length < voiceCount) {
      const voice = new model.Voice();
      bar.addVoice(voice);
      appendPlaceholderBeat(voice);
    }
  });
}

/** Same as alphaTab's internal ModelUtils.appendPlaceholderVoice: one invisible empty beat. */
function appendPlaceholderBeat(voice: alphaTab.model.Voice): void {
  const beat = new model.Beat();
  beat.isEmpty = true;
  beat.duration = 4;
  voice.addBeat(beat);
}

function buildBeat(
  mhd: Beat,
  mhdStaff: Staff,
  staff: alphaTab.model.Staff,
  dynamic: number,
  idMap: IdMap,
  losses: Loss[],
): alphaTab.model.Beat {
  const beat = new model.Beat();
  idMap.set(beat, mhd.id);
  beat.duration = mhd.duration.value;
  beat.dots = mhd.duration.dots;
  if (mhd.duration.tuplet) {
    beat.tupletNumerator = mhd.duration.tuplet.actual;
    beat.tupletDenominator = mhd.duration.tuplet.normal;
  }
  if (mhd.grace) beat.graceType = mhd.grace === 'onBeat' ? 1 : 2;
  beat.dynamics = dynamic;
  if (mhd.text) beat.text = mhd.text;
  if (mhd.lyrics) beat.lyrics = [...mhd.lyrics];
  const fx = mhd.effects;
  if (fx) {
    if (fx.vibrato) beat.vibrato = VIBRATO[fx.vibrato];
    if (fx.tremoloPicking) {
      const tremolo = new model.TremoloPickingEffect();
      tremolo.marks = TREMOLO_MARKS[fx.tremoloPicking];
      beat.tremoloPicking = tremolo;
    }
    if (fx.pickStroke) beat.pickStroke = fx.pickStroke === 'up' ? 1 : 2;
    if (fx.brush) {
      beat.brushType = fx.brush.direction === 'up' ? 1 : 2;
      beat.brushDuration = fx.brush.duration
        ? durationTicks(fx.brush.duration)
        : defaultBrushTicks(mhd);
    }
    if (fx.tap) beat.tap = true;
    if (fx.slap) beat.slap = true;
    if (fx.pop) beat.pop = true;
    if (fx.fadeIn) beat.fade = 1;
    if (fx.whammy) {
      beat.whammyBarType = 1;
      for (const p of fx.whammy) beat.addWhammyBarPoint(new model.BendPoint(p.offset, p.value));
    }
    if (fx.crescendo) beat.crescendo = fx.crescendo === 'crescendo' ? 1 : 2;
  }
  for (const mhdNote of mhd.notes) {
    const note = buildNote(mhdNote, mhdStaff, staff, idMap, losses);
    if (staff.isPercussion) {
      // Drum tablature (alphaTab 1.9) draws percussion notes on "strings". The alphaTex importer gives
      // each note the first free string from the top; the model API leaves it NaN, so do the same here.
      const strings = staff.tuning.length;
      for (let s = strings; s >= 1; s--) {
        if (!beat.notes.some((n) => n.string === s)) {
          note.string = s;
          break;
        }
      }
    }
    beat.addNote(note);
  }
  return beat;
}

function buildNote(
  mhd: Note,
  mhdStaff: Staff,
  staff: alphaTab.model.Staff,
  idMap: IdMap,
  losses: Loss[],
): alphaTab.model.Note {
  const note = new model.Note();
  idMap.set(note, mhd.id);
  if (staff.isPercussion) {
    const articulation = percussionArticulation(mhd.pitch ?? 38, mhd.drumTechnique);
    if (articulation === undefined) {
      losses.push({
        feature: mhd.drumTechnique ? `drumTechnique.${mhd.drumTechnique}` : 'percussion.pitch',
        id: mhd.id,
        detail: `no alphaTab articulation for GM ${mhd.pitch ?? '?'}${mhd.drumTechnique ? ` + ${mhd.drumTechnique}` : ''}; plain GM key used`,
      });
    }
    // The value must be an index into track.percussionArticulations: a raw id renders and plays,
    // but Gp7Exporter writes wrong instruments for it. PercussionMapper is not public, so the
    // articulation objects come from articulationById() (one alphaTex parse, cached).
    const known = articulationById(articulation ?? mhd.pitch ?? 38);
    note.percussionArticulation = known
      ? staff.track.getOrRegisterPercussionArticulation(known)
      : (articulation ?? mhd.pitch ?? 38);
  } else if (mhd.string !== undefined && mhd.fret !== undefined) {
    note.string = alphaTabString(mhdStaff, mhd.string);
    note.fret = mhd.fret;
  } else if (mhd.pitch !== undefined) {
    note.octave = Math.floor(mhd.pitch / 12);
    note.tone = mhd.pitch % 12;
  }
  if (mhd.spelling) note.accidentalMode = ACCIDENTAL_MODE[mhd.spelling.alter] ?? 0;
  if (mhd.tiedFromPrevious) note.isTieDestination = true;
  if (mhd.velocity !== undefined)
    losses.push({
      feature: 'note.velocity',
      id: mhd.id,
      detail: 'alphaTab has dynamics only, no per-note velocity',
    });
  if (mhd.hand !== undefined)
    losses.push({
      feature: 'note.hand',
      id: mhd.id,
      detail: 'no cross-staff hand on alphaTab notes',
    });
  const fx = mhd.effects;
  if (fx) {
    if (fx.bend) {
      note.bendType = 1;
      for (const p of fx.bend) note.addBendPoint(new model.BendPoint(p.offset, p.value));
    }
    if (fx.slideOut) note.slideOutType = SLIDE_OUT[fx.slideOut];
    if (fx.slideIn) note.slideInType = SLIDE_IN[fx.slideIn];
    if (fx.hammerPullOrigin) note.isHammerPullOrigin = true;
    if (fx.palmMute) note.isPalmMute = true;
    if (fx.letRing) note.isLetRing = true;
    if (fx.deadNote) note.isDead = true;
    if (fx.ghost) note.isGhost = true;
    if (fx.staccato) note.isStaccato = true;
    if (fx.accent) note.accentuated = ACCENT[fx.accent];
    if (fx.harmonic) {
      note.harmonicType = HARMONIC[fx.harmonic.type];
      // alphaTex `nh` derives the value from the fret and takes no argument; the other kinds take one.
      if (fx.harmonic.type === 'natural') note.harmonicValue = naturalHarmonicValue(mhd.fret ?? 12);
      else if (fx.harmonic.fret !== undefined) note.harmonicValue = fx.harmonic.fret;
    }
    if (fx.vibrato) note.vibrato = VIBRATO[fx.vibrato];
    if (fx.trill) {
      // trillValue is a pitch: fret + open string (+ capo), computed by alphaTab from the string.
      const open = mhdStaff.stringed?.tuning[(mhd.string ?? 1) - 1] ?? 0;
      note.trillValue = fx.trill.fret + open + (mhdStaff.stringed?.capo ?? 0);
      note.trillSpeed = fx.trill.speed;
    }
    if (fx.fingering?.left !== undefined) {
      const finger = leftFinger(fx.fingering.left);
      if (finger === undefined)
        losses.push({
          feature: 'note.fingering.left',
          id: mhd.id,
          detail: 'finger 5 has no alphaTab value',
        });
      else note.leftHandFinger = finger;
    }
    if (fx.fingering?.right) note.rightHandFinger = RIGHT_FINGER[fx.fingering.right];
  }
  return note;
}

/**
 * Q-E: positioned master-bar fermatas. alphaTab stores a fermata at an integer tick offset and
 * draws it only on a beat starting exactly there. A position that is not a whole tick, or where no
 * beat starts, is never rounded or moved: no alphaTab fermata is created and a diagnostic is
 * recorded (the MHD position itself is untouched).
 */
function applyFermatas(doc: MhdDocument, score: alphaTab.model.Score, losses: Loss[]): void {
  doc.masterBars.forEach((mhd, i) => {
    for (const f of mhd.fermatas ?? []) {
      const { tick, onBeat } = fermataPlacement(doc, i, f.position);
      const at = `[${f.position.join(', ')}]`;
      if (tick === undefined) {
        losses.push({
          feature: 'masterBar.fermatas.position',
          id: mhd.id,
          detail: `fermata at ${at} is not a whole alphaTab tick; not placed`,
          code: 'unsupported',
          severity: 'warning',
          aspect: 'notation',
        });
        continue;
      }
      if (!onBeat) {
        losses.push({
          feature: 'masterBar.fermatas.position',
          id: mhd.id,
          detail: `no beat starts at fermata ${at} (tick ${tick}); alphaTab cannot draw it, not placed`,
          code: 'render-limited',
          severity: 'warning',
          aspect: 'notation',
        });
        continue;
      }
      const fermata = new model.Fermata();
      fermata.type = FERMATA_TYPE[f.type ?? 'medium'];
      score.masterBars[i]?.addFermata(tick, fermata);
    }
  });
}

let articulationTable: Map<number, alphaTab.model.InstrumentArticulation> | undefined;

/** alphaTab's built-in articulation for an id, read once from a parsed alphaTex percussion track. */
export function articulationById(id: number): alphaTab.model.InstrumentArticulation | undefined {
  if (!articulationTable) {
    const ids = [...KNOWN_ARTICULATION_IDS, 91, 92, 93, 94, 95, 96, 97, 98, 126, 127];
    const tex = `\\track "D" { instrument percussion }\n\\staff { score }\n${ids.map((i) => `(${i}).4`).join(' ')}`;
    const settings = new alphaTab.Settings();
    settings.core.logLevel = alphaTab.LogLevel.None;
    const track = alphaTab.importer.ScoreLoader.loadAlphaTex(tex, settings).tracks[0];
    articulationTable = new Map((track?.percussionArticulations ?? []).map((a) => [a.id, a]));
  }
  return articulationTable.get(id);
}
