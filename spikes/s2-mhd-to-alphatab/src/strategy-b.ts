// Strategy B: generate alphaTex 1.9 from MHD and import it with alphaTab's AlphaTexImporter
// (spike S2, ROADMAP.md S2-05). Only syntax confirmed in the alphaTab 1.9.0 parser is used.
// Metadata arguments are always parenthesised: without parentheses the parser keeps reading
// arguments, e.g. `\\section "Groove" D#4{acc default}` takes the note as a second argument.
import * as alphaTab from '@coderline/alphatab';
import type { Bar, Beat, MhdDocument, Note, Staff, Track } from '@musichub/music-model';
import type { Loss } from './losses.ts';
import {
  TREMOLO_MARKS,
  defaultClef,
  durationTicks,
  fermataPlacement,
  firstBeatAt,
  leftFinger,
  mixerBalance,
  mixerVolume,
  percussionArticulation,
  positionRatio,
  resolvedKeySignatures,
  resolvedTimeSignatures,
} from './mapping.ts';

export interface StrategyBResult {
  score: alphaTab.model.Score;
  tex: string;
  losses: Loss[];
  /** Milliseconds: alphaTex generation, and parsing (`ScoreLoader.loadAlphaTex`, includes finish()). */
  timings: { generate: number; parse: number };
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const STEP_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC_NAME: Record<number, string> = {
  [-2]: 'forcedoubleflat',
  [-1]: 'forceflat',
  1: 'forcesharp',
  2: 'forcedoublesharp',
};
const KEY_NAMES_MAJOR = [
  'cb',
  'gb',
  'db',
  'ab',
  'eb',
  'bb',
  'f',
  'c',
  'g',
  'd',
  'a',
  'e',
  'b',
  'f#',
  'c#',
];
const KEY_NAMES_MINOR = [
  'abminor',
  'ebminor',
  'bbminor',
  'fminor',
  'cminor',
  'gminor',
  'dminor',
  'aminor',
  'eminor',
  'bminor',
  'f#minor',
  'c#minor',
  'g#minor',
  'd#minor',
  'a#minor',
];
const DIRECTION_NAME: Record<string, string> = {
  fine: 'fine',
  segno: 'segno',
  segnoSegno: 'segnosegno',
  coda: 'coda',
  doubleCoda: 'doublecoda',
  daCapo: 'dacapo',
  daCapoAlCoda: 'dacapoalcoda',
  daCapoAlFine: 'dacapoalfine',
  dalSegno: 'dalsegno',
  dalSegnoAlCoda: 'dalsegnoalcoda',
  dalSegnoAlFine: 'dalsegnoalfine',
  toCoda: 'dacoda',
};
const TRIPLET_FEEL_NAME: Record<string, string> = {
  none: 'none',
  '8th': 'triplet8th',
  '16th': 'triplet16th',
  dotted8th: 'dotted8th',
  dotted16th: 'dotted16th',
  scottish8th: 'scottish8th',
  scottish16th: 'scottish16th',
};
const HARMONIC_TAG: Record<string, string> = {
  natural: 'nh',
  artificial: 'ah',
  pinch: 'ph',
  tap: 'th',
  semi: 'sh',
  feedback: 'fh',
};
const SLIDE_OUT_TAG = { shift: 'ss', legato: 'sl', outUp: 'sou', outDown: 'sod' } as const;
const SLIDE_IN_TAG = { intoFromBelow: 'sib', intoFromAbove: 'sia' } as const;
const RIGHT_FINGER_NUMBER = { p: 1, i: 2, m: 3, a: 4, c: 5 } as const;
/** Placeholder hex for MHD palette ids (same values as Strategy A). */
const TRACK_COLOR_HEX = [
  '#3B82F6',
  '#EF4444',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#6366F1',
  '#84CC16',
  '#06B6D4',
  '#A855F7',
];

export function str(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Shortest round-trip decimal (alphaTex numbers are parsed with parseFloat). A rounded form such as
 * 0.333333333333 for 1/3 moves a tempo change from tick 2240 to 2239.99999…
 */
function num(n: number): string {
  const s = String(n);
  if (s.includes('e'))
    throw new Error(`number ${s} needs exponent notation, not supported by alphaTex`);
  return s;
}

function pitchName(pitch: number, spelling: Note['spelling']): string {
  if (spelling) {
    const octave =
      Math.floor((pitch - spelling.alter - (STEP_SEMITONE[spelling.step] ?? 0)) / 12) - 1;
    const alter = spelling.alter > 0 ? '#'.repeat(spelling.alter) : 'b'.repeat(-spelling.alter);
    return `${spelling.step}${alter}${octave}`;
  }
  return `${NOTE_NAMES[pitch % 12] ?? 'C'}${Math.floor(pitch / 12) - 1}`;
}

function firstBeatId(track: Track): string | undefined {
  return track.staves[0]?.bars[0]?.voices[0]?.beats[0]?.id;
}

export function toAlphaTex(doc: MhdDocument, losses: Loss[] = []): string {
  const out: string[] = [];
  const meta = doc.meta;
  out.push(`\\title (${str(meta.title)})`);
  const metaTags: [string, string | undefined][] = [
    ['subtitle', meta.subtitle],
    ['artist', meta.artist],
    ['album', meta.album],
    ['music', meta.composer],
    ['words', meta.lyricist],
    ['tab', meta.transcriber],
    ['copyright', meta.copyright],
    ['notices', meta.notes],
  ];
  for (const [tag, value] of metaTags) if (value) out.push(`\\${tag} (${str(value)})`);

  const ts = resolvedTimeSignatures(doc);
  const ks = resolvedKeySignatures(doc);
  // Q-E: a fermata is written on the first non-grace beat (document order) that starts exactly at
  // its tick; the importer then registers it on the master bar at that beat's start. A position
  // that is not a whole tick or not a beat start is never rounded or moved (diagnostic instead).
  const fermataBeats = new Map<string, 'short' | 'medium' | 'long'>();
  doc.masterBars.forEach((mb, barIndex) => {
    for (const f of mb.fermatas ?? []) {
      const { tick, onBeat } = fermataPlacement(doc, barIndex, f.position);
      const at = `[${f.position.join(', ')}]`;
      const beatId =
        tick !== undefined && onBeat ? firstBeatAt(doc, barIndex, tick)?.id : undefined;
      if (beatId) {
        fermataBeats.set(beatId, f.type ?? 'medium');
        continue;
      }
      losses.push({
        feature: 'masterBar.fermatas.position',
        id: mb.id,
        detail:
          tick === undefined
            ? `fermata at ${at} is not a whole alphaTab tick; not placed`
            : `no beat starts at fermata ${at} (tick ${tick}); alphaTab cannot draw it, not placed`,
        code: 'unsupported',
        severity: 'warning',
        aspect: 'notation',
      });
    }
  });

  doc.tracks.forEach((track, trackIndex) => {
    const colorIndex = Number(track.color.slice('track.'.length)) - 1;
    const props = [
      `color ${str(TRACK_COLOR_HEX[colorIndex] ?? '#000000')}`,
      `volume ${mixerVolume(track.mixer.volume)}`,
      `balance ${mixerBalance(track.mixer.pan)}`,
      track.instrument.percussion
        ? 'instrument percussion'
        : `instrument ${track.instrument.midiProgram}`,
    ];
    if (track.instrument.bank) props.push(`bank ${track.instrument.bank}`);
    if (track.mixer.mute) props.push('mute');
    if (track.mixer.solo) props.push('solo');
    const names = track.shortName ? `${str(track.name)} ${str(track.shortName)}` : str(track.name);
    out.push(`\\track (${names}) { ${props.join(' ')} }`);
    // No MIDI channel syntax in alphaTex: the importer assigns channels itself.
    if (track.staves.some((s) => s.hand !== undefined))
      losses.push({
        feature: 'staff.hand',
        id: track.id,
        detail: 'no hand concept on alphaTab staves',
      });
    track.staves.forEach((staff, staffIndex) => {
      writeStaff(out, doc, track, trackIndex, staff, staffIndex, ts, ks, fermataBeats, losses);
    });
  });
  return out.join('\n');
}

function writeStaff(
  out: string[],
  doc: MhdDocument,
  track: Track,
  trackIndex: number,
  staff: Staff,
  staffIndex: number,
  ts: { numerator: number; denominator: number }[],
  ks: { fifths: number; mode: 'major' | 'minor' }[],
  fermataBeats: Map<string, 'short' | 'medium' | 'long'>,
  losses: Loss[],
): void {
  const display = [
    staff.display.standard ? 'score' : '',
    staff.display.tab ? 'tabs' : '',
    staff.display.slash ? 'slash' : '',
    staff.display.numbered ? 'numbered' : '',
  ].filter(Boolean);
  out.push(`  \\staff { ${display.join(' ')} }`);
  if (staff.stringed) {
    out.push(
      `    \\tuning (${staff.stringed.tuning.map((p) => pitchName(p, undefined)).join(' ')})`,
    );
    if (staff.stringed.capo) out.push(`    \\capo (${staff.stringed.capo})`);
    losses.push({
      feature: 'staff.stringed.fretCount',
      id: staff.id,
      detail: 'alphaTab has no fret count',
    });
  }
  // alphaTex `displaytranspose n` stores -n; MHD -12 (guitar) is written as 12. Always explicit,
  // because alphaTex otherwise applies a default per MIDI program.
  out.push(`    \\displaytranspose (${-(staff.transpositionPitch ?? 0)})`);
  if (track.instrument.percussion) out.push('    \\articulation defaults');

  const voiceCount = Math.max(...staff.bars.map((b) => b.voices.length));
  const isFirstStaff = trackIndex === 0 && staffIndex === 0;
  for (let v = 0; v < voiceCount; v++) {
    out.push('    \\voice');
    let clef: NonNullable<Bar['clef']> | undefined;
    staff.bars.forEach((bar, barIndex) => {
      const meta: string[] = [];
      const mb = doc.masterBars[barIndex];
      if (isFirstStaff && v === 0 && mb) {
        const prevTs = ts[barIndex - 1];
        const curTs = ts[barIndex];
        if (
          curTs &&
          (barIndex === 0 ||
            prevTs?.numerator !== curTs.numerator ||
            prevTs.denominator !== curTs.denominator)
        )
          meta.push(`\\ts (${curTs.numerator} ${curTs.denominator})`);
        if (mb.isAnacrusis) meta.push('\\ac');
        if (mb.repeatStart) meta.push('\\ro');
        if (mb.alternateEndings) meta.push(`\\ae (${mb.alternateEndings.join(' ')})`);
        if (mb.repeatEnd) meta.push(`\\rc (${mb.repeatEnd.count})`);
        if (mb.tripletFeel) meta.push(`\\tf (${TRIPLET_FEEL_NAME[mb.tripletFeel] ?? 'none'})`);
        if (mb.section)
          meta.push(
            mb.section.letter
              ? `\\section (${str(mb.section.letter)} ${str(mb.section.text)})`
              : `\\section (${str(mb.section.text)})`,
          );
        if (mb.direction) meta.push(`\\jump (${DIRECTION_NAME[mb.direction] ?? 'fine'})`);
        for (const tc of mb.tempoChanges ?? []) {
          const ratio = positionRatio(tc.position);
          meta.push(
            tc.label
              ? `\\tempo (${num(tc.bpm)} ${str(tc.label)} ${num(ratio)})`
              : ratio === 0
                ? `\\tempo (${num(tc.bpm)})`
                : `\\tempo (${num(tc.bpm)} ${num(ratio)})`,
          );
        }
      }
      if (v === 0) {
        const nextClef = bar.clef ?? clef ?? defaultClef(track, staffIndex);
        if (nextClef !== clef) meta.push(`\\clef (${nextClef.toLowerCase()})`);
        clef = nextClef;
        const k = ks[barIndex];
        const prevK = ks[barIndex - 1];
        if (k && (barIndex === 0 || prevK?.fifths !== k.fifths || prevK.mode !== k.mode))
          meta.push(
            `\\ks (${(k.mode === 'major' ? KEY_NAMES_MAJOR : KEY_NAMES_MINOR)[k.fifths + 7] ?? 'c'})`,
          );
        for (const pedal of bar.sustainPedal ?? [])
          meta.push(
            `\\${pedal.type === 'down' ? 'spd' : 'spu'} (${num(positionRatio(pedal.position))})`,
          );
      }
      const voice = bar.voices[v];
      const beats = voice
        ? voice.beats.map((b) => beatTex(b, staff, track, bar.ottava, fermataBeats, losses))
        : [];
      const sep = barIndex < staff.bars.length - 1 ? ' |' : '';
      out.push(`      ${[...meta, ...beats].join(' ')}${sep}`);
    });
  }
}

function beatTex(
  beat: Beat,
  staff: Staff,
  track: Track,
  ottava: Bar['ottava'],
  fermataBeats: Map<string, 'short' | 'medium' | 'long'>,
  losses: Loss[],
): string {
  const notes = beat.notes.map((n) => noteTex(n, staff, track, losses));
  const value = beat.rest
    ? 'r'
    : notes.length === 1 && !track.instrument.percussion
      ? (notes[0] ?? 'r')
      : `(${notes.join(' ')})`;
  const props: string[] = [];
  const d = beat.duration;
  if (d.dots === 1) props.push('d');
  if (d.dots === 2) props.push('dd');
  if (d.tuplet) props.push(`tu (${d.tuplet.actual} ${d.tuplet.normal})`);
  if (beat.grace) props.push(beat.grace === 'onBeat' ? 'gr ob' : 'gr bb');
  if (beat.dynamic) props.push(`dy ${beat.dynamic}`);
  if (beat.text) props.push(`txt ${str(beat.text)}`);
  beat.lyrics?.forEach((line, i) => props.push(`lyrics (${i} ${str(line)})`));
  const fx = beat.effects;
  if (fx) {
    if (fx.vibrato) props.push(fx.vibrato === 'wide' ? 'vw' : 'v');
    if (fx.tremoloPicking) props.push(`tp ${TREMOLO_MARKS[fx.tremoloPicking]}`);
    if (fx.pickStroke) props.push(fx.pickStroke === 'up' ? 'su' : 'sd');
    if (fx.brush) {
      const tag = fx.brush.direction === 'up' ? 'bu' : 'bd';
      props.push(fx.brush.duration ? `${tag} ${num(durationTicks(fx.brush.duration))}` : tag);
    }
    if (fx.tap) props.push('tt');
    if (fx.slap) props.push('s');
    if (fx.pop) props.push('p');
    if (fx.fadeIn) props.push('f');
    if (fx.whammy)
      props.push(`tbe (custom ${fx.whammy.map((p) => `${p.offset} ${p.value}`).join(' ')})`);
    if (fx.crescendo) props.push(fx.crescendo === 'crescendo' ? 'cre' : 'dec');
  }
  const fermata = fermataBeats.get(beat.id);
  if (fermata) props.push(`fermata (${fermata} 0)`);
  // Q-D: display-only octave line on every beat of the bar (Beat.ottava); no `\\ottava`, which
  // would set the clef ottava.
  if (ottava) props.push(`ot ${ottava}`);
  // `instrument percussion` leaves a program 25 instrument automation on the first beat, which sends
  // program change 25 on the drum channel; a beat-level `instrument 0` replaces it (Strategy A: 0).
  if (track.instrument.percussion && beat.id === firstBeatId(track)) props.push('instrument 0');
  return `${value}.${d.value}${props.length ? `{${props.join(' ')}}` : ''}`;
}

function noteTex(note: Note, staff: Staff, track: Track, losses: Loss[]): string {
  let value: string;
  const props: string[] = [];
  if (track.instrument.percussion) {
    const articulation = percussionArticulation(note.pitch ?? 38, note.drumTechnique);
    if (articulation === undefined)
      losses.push({
        feature: note.drumTechnique ? `drumTechnique.${note.drumTechnique}` : 'percussion.pitch',
        id: note.id,
        detail: `no alphaTab articulation for GM ${note.pitch ?? '?'}${note.drumTechnique ? ` + ${note.drumTechnique}` : ''}; plain GM key used`,
      });
    // A lone number is parsed as `fret.string` (`92.8`), so a single articulation is always a chord.
    value = String(articulation ?? note.pitch ?? 38);
  } else if (note.string !== undefined && note.fret !== undefined) {
    value = `${note.fret}.${note.string}`; // alphaTex strings count from the highest, like MHD
  } else {
    const pitch = note.pitch ?? 60;
    value = pitchName(pitch, note.spelling);
    // A sharp in the generated name forces an accidental mode; without MHD spelling the mode
    // must stay "default" (alphaTab decides), as in Strategy A.
    if (!note.spelling && value.includes('#')) props.push('acc default');
  }
  if (note.tiedFromPrevious) props.push('t');
  if (note.velocity !== undefined)
    losses.push({
      feature: 'note.velocity',
      id: note.id,
      detail: 'alphaTab has dynamics only, no per-note velocity',
    });
  if (note.hand !== undefined)
    losses.push({
      feature: 'note.hand',
      id: note.id,
      detail: 'no cross-staff hand on alphaTab notes',
    });
  const fx = note.effects;
  if (fx) {
    if (fx.bend)
      props.push(`be (custom ${fx.bend.map((p) => `${p.offset} ${p.value}`).join(' ')})`);
    if (fx.slideOut) props.push(SLIDE_OUT_TAG[fx.slideOut]);
    if (fx.slideIn) props.push(SLIDE_IN_TAG[fx.slideIn]);
    if (fx.hammerPullOrigin) props.push('h');
    if (fx.palmMute) props.push('pm');
    if (fx.letRing) props.push('lr');
    if (fx.deadNote) props.push('x');
    if (fx.ghost) props.push('g');
    if (fx.staccato) props.push('st');
    if (fx.accent) props.push(fx.accent === 'heavy' ? 'hac' : 'ac');
    if (fx.harmonic) {
      const tag = HARMONIC_TAG[fx.harmonic.type] ?? 'nh';
      props.push(
        fx.harmonic.fret !== undefined && tag !== 'nh' ? `${tag} ${num(fx.harmonic.fret)}` : tag,
      );
    }
    if (fx.vibrato) props.push(fx.vibrato === 'wide' ? 'vw' : 'v');
    if (fx.trill) props.push(`tr (${fx.trill.fret} ${fx.trill.speed})`);
    if (fx.fingering?.left !== undefined) {
      const finger = leftFinger(fx.fingering.left);
      if (finger === undefined)
        losses.push({
          feature: 'note.fingering.left',
          id: note.id,
          detail: 'finger 5 has no alphaTab value',
        });
      else props.push(`lf ${finger + 1}`);
    }
    if (fx.fingering?.right) props.push(`rf ${RIGHT_FINGER_NUMBER[fx.fingering.right]}`);
  }
  if (note.spelling) {
    const acc = ACC_NAME[note.spelling.alter];
    if (acc) props.push(`acc ${acc}`);
  }
  return `${value}${props.length ? `{${props.join(' ')}}` : ''}`;
}

export function toAlphaTabViaTex(doc: MhdDocument, settings: alphaTab.Settings): StrategyBResult {
  const losses: Loss[] = [];
  const t0 = performance.now();
  const tex = toAlphaTex(doc, losses);
  const t1 = performance.now();
  const score = alphaTab.importer.ScoreLoader.loadAlphaTex(tex, settings);
  const t2 = performance.now();
  return { score, tex, losses, timings: { generate: t1 - t0, parse: t2 - t1 } };
}
