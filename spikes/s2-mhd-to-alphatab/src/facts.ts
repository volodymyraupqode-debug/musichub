// Comparable facts about a score, extracted from an alphaTab Score after finish() and computed
// independently from MHD semantics. A feature counts as supported only if the facts match.
import type * as alphaTab from '@coderline/alphatab';
import type { MhdDocument } from '@musichub/music-model';
import {
  CLEF,
  FERMATA_TYPE,
  fermataPlacement,
  DIRECTION,
  OTTAVA,
  defaultClef,
  mixerBalance,
  mixerVolume,
  durationTicks,
  positionRatio,
  resolvedKeySignatures,
  resolvedTimeSignatures,
} from './mapping.ts';

/** One fact group per MHD feature; values are JSON-comparable. */
export type Facts = Record<string, unknown[]>;

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** Facts from an alphaTab Score (after finish). Placeholder beats (`isEmpty`) are skipped. */
export function scoreFacts(score: alphaTab.model.Score): Facts {
  const f: Facts = {
    structure: [
      score.tracks.length,
      score.masterBars.length,
      ...score.tracks.map((t) => t.staves.length),
    ],
    timeSignature: score.masterBars.map((m) => [
      m.timeSignatureNumerator,
      m.timeSignatureDenominator,
    ]),
    keySignature: [],
    tempo: score.masterBars.map((m) =>
      m.tempoAutomations.map((a) => [round(a.value), round(a.ratioPosition), a.text]),
    ),
    anacrusis: score.masterBars.map((m) => m.isAnacrusis),
    repeats: score.masterBars.map((m) => [m.isRepeatStart, m.repeatCount]),
    alternateEndings: score.masterBars.map((m) => m.alternateEndings),
    directions: score.masterBars.map((m) => [...(m.directions ?? [])].sort((a, b) => a - b)),
    sections: score.masterBars.map((m) => (m.section ? [m.section.marker, m.section.text] : null)),
    // [tick, FermataType] per master bar (alphaTab keys fermatas by tick offset).
    fermata: score.masterBars.map((m) =>
      [...(m.fermata?.entries() ?? [])].map(([tick, f]) => [tick, f.type]),
    ),
    beatOttava: [],
    tripletFeel: score.masterBars.map((m) => m.tripletFeel),
    trackInfo: score.tracks.map((t) => [
      t.name,
      t.playbackInfo.program,
      t.playbackInfo.bank,
      t.playbackInfo.volume,
      t.playbackInfo.balance,
      t.playbackInfo.isMute,
      t.playbackInfo.isSolo,
      t.isPercussion,
    ]),
    staffDisplay: [],
    tuning: [],
    transposition: [],
    clef: [],
    ottava: [],
    sustainPedal: [],
    voices: [],
    rhythm: [],
    grace: [],
    rests: [],
    pitch: [],
    chords: [],
    ties: [],
    percussion: [],
    dynamics: [],
    noteEffects: [],
    beatEffects: [],
    textLyrics: [],
  };
  for (const [ti, track] of score.tracks.entries()) {
    for (const [si, staff] of track.staves.entries()) {
      f.staffDisplay?.push([
        ti,
        si,
        staff.showStandardNotation,
        staff.showTablature,
        staff.showSlash,
        staff.showNumbered,
      ]);
      f.tuning?.push([
        ti,
        si,
        staff.isPercussion ? [] : [...staff.stringTuning.tunings],
        staff.capo,
      ]);
      f.transposition?.push([ti, si, staff.displayTranspositionPitch, staff.transpositionPitch]);
      for (const bar of staff.bars) {
        const key = [ti, si, bar.index];
        f.keySignature?.push([...key, bar.keySignature, bar.keySignatureType]);
        f.clef?.push([...key, bar.clef]);
        f.ottava?.push([...key, bar.clefOttava]);
        // Hold markers at 0 are inserted by Bar.finish for a pedal held through a bar without markers;
        // Down after Down becomes Hold. Compare the down/up events only.
        for (const p of bar.sustainPedals)
          if (p.pedalType !== 1)
            f.sustainPedal?.push([...key, p.pedalType, round(p.ratioPosition)]);
        for (const voice of bar.voices) {
          const beats = voice.beats.filter((b) => !b.isEmpty);
          if (beats.length === 0) continue;
          f.voices?.push([...key, voice.index, beats.length]);
          for (const beat of beats) {
            const at = [...key, voice.index, beat.index];
            f.rhythm?.push([
              ...at,
              beat.playbackStart,
              beat.playbackDuration,
              beat.duration,
              beat.dots,
              beat.tupletNumerator,
              beat.tupletDenominator,
            ]);
            f.beatOttava?.push([...at, beat.ottava]);
            if (beat.graceType !== 0) f.grace?.push([...at, beat.graceType]);
            if (beat.isRest) f.rests?.push(at);
            f.dynamics?.push([...at, beat.dynamics]);
            if (beat.text || beat.lyrics) f.textLyrics?.push([...at, beat.text, beat.lyrics]);
            const bfx = [
              beat.vibrato,
              beat.tremoloPicking?.marks ?? 0,
              beat.pickStroke,
              beat.brushType,
              round(beat.brushDuration),
              beat.tap,
              beat.slap,
              beat.pop,
              beat.fade,
              beat.crescendo,
              (beat.whammyBarPoints ?? []).map((p) => [p.offset, p.value]),
            ];
            if (
              JSON.stringify(bfx) !== JSON.stringify([0, 0, 0, 0, 0, false, false, false, 0, 0, []])
            )
              f.beatEffects?.push([...at, ...bfx]);
            if (beat.notes.length > 1) f.chords?.push([...at, beat.notes.length]);
            for (const note of beat.notes) {
              const n = [...at, note.index];
              if (note.isPercussion) {
                const arts = track.percussionArticulations;
                const id =
                  note.percussionArticulation < arts.length
                    ? arts[note.percussionArticulation]?.id
                    : note.percussionArticulation;
                f.percussion?.push([...n, id, note.realValue, note.string]);
              } else {
                f.pitch?.push([
                  ...n,
                  note.realValueWithoutHarmonic,
                  note.isStringed ? note.string : null,
                  note.isStringed ? note.fret : null,
                  note.accidentalMode,
                ]);
              }
              if (note.isTieDestination) f.ties?.push([...n, note.tieOrigin !== null]);
              const nfx = [
                note.bendType,
                (note.bendPoints ?? []).map((p) => [p.offset, p.value]),
                note.slideOutType,
                note.slideInType,
                note.isHammerPullOrigin,
                note.isPalmMute,
                note.isLetRing,
                note.isDead,
                note.isGhost,
                note.isStaccato,
                note.accentuated,
                note.harmonicType,
                round(note.harmonicValue),
                note.vibrato,
                note.trillValue,
                note.isTrill ? note.trillSpeed : 0,
                note.leftHandFinger,
                note.rightHandFinger,
              ];
              if (
                JSON.stringify(nfx) !==
                JSON.stringify([
                  0,
                  [],
                  0,
                  0,
                  false,
                  false,
                  false,
                  false,
                  false,
                  false,
                  0,
                  0,
                  0,
                  0,
                  -1,
                  0,
                  -2,
                  -2,
                ])
              )
                f.noteEffects?.push([...n, ...nfx]);
            }
          }
        }
      }
    }
  }
  return f;
}

/**
 * The subset of facts that follows from MHD semantics alone (no alphaTab mapping code):
 * structure, sounding pitch, rhythm in ticks, ties, grace, rests, repeats, endings, tempo,
 * time/key signature, pedal positions and the GM key a percussion note sounds.
 */
export function mhdFacts(doc: MhdDocument): Facts {
  const ts = resolvedTimeSignatures(doc);
  const ks = resolvedKeySignatures(doc);
  const f: Facts = {
    structure: [
      doc.tracks.length,
      doc.masterBars.length,
      ...doc.tracks.map((t) => t.staves.length),
    ],
    timeSignature: ts.map((t) => [t.numerator, t.denominator]),
    keySignature: [],
    tempo: doc.masterBars.map((m) =>
      (m.tempoChanges ?? []).map((t) => [t.bpm, round(positionRatio(t.position)), t.label ?? '']),
    ),
    anacrusis: doc.masterBars.map((m) => m.isAnacrusis === true),
    repeats: doc.masterBars.map((m) => [m.repeatStart === true, m.repeatEnd?.count ?? 0]),
    alternateEndings: doc.masterBars.map((m) =>
      (m.alternateEndings ?? []).reduce((mask, n) => mask | (1 << (n - 1)), 0),
    ),
    directions: doc.masterBars.map((m) => (m.direction ? [DIRECTION[m.direction]] : [])),
    sections: doc.masterBars.map((m) =>
      m.section ? [m.section.letter ?? '', m.section.text] : null,
    ),
    trackInfo: doc.tracks.map((t) => [
      t.name,
      t.instrument.percussion ? 0 : t.instrument.midiProgram,
      t.instrument.bank ?? 0,
      mixerVolume(t.mixer.volume),
      mixerBalance(t.mixer.pan),
      t.mixer.mute,
      t.mixer.solo,
      t.instrument.percussion,
    ]),
    staffDisplay: [],
    tuning: [],
    transposition: [],
    clef: [],
    ottava: [],
    beatOttava: [],
    // Representable fermatas only (whole tick on a beat start); the others produce diagnostics.
    fermata: doc.masterBars.map((m, barIndex) =>
      (m.fermatas ?? []).flatMap((fermata) => {
        const { tick, onBeat } = fermataPlacement(doc, barIndex, fermata.position);
        return tick !== undefined && onBeat ? [[tick, FERMATA_TYPE[fermata.type ?? 'medium']]] : [];
      }),
    ),
    sustainPedal: [],
    voices: [],
    rhythm: [],
    grace: [],
    rests: [],
    pitch: [],
    chords: [],
    ties: [],
    percussion: [],
  };
  for (const [ti, track] of doc.tracks.entries()) {
    for (const [si, staff] of track.staves.entries()) {
      f.staffDisplay?.push([
        ti,
        si,
        staff.display.standard,
        staff.display.tab,
        staff.display.slash,
        staff.display.numbered,
      ]);
      f.tuning?.push([
        ti,
        si,
        staff.stringed ? [...staff.stringed.tuning] : [],
        staff.stringed?.capo ?? 0,
      ]);
      f.transposition?.push([ti, si, staff.transpositionPitch ?? 0, 0]);
      let clef = defaultClef(track, si);
      for (const [bi, bar] of staff.bars.entries()) {
        const key = [ti, si, bi];
        if (bar.clef) clef = bar.clef;
        f.clef?.push([...key, CLEF[clef]]);
        // Q-D: the clef ottava is never used; the octave line is on every beat (Beat.ottava).
        f.ottava?.push([...key, OTTAVA.regular]);
        const k = ks[bi] ?? { fifths: 0, mode: 'major' };
        f.keySignature?.push([...key, k.fifths, k.mode === 'major' ? 0 : 1]);
        for (const p of bar.sustainPedal ?? [])
          f.sustainPedal?.push([
            ...key,
            p.type === 'down' ? 0 : 2,
            round(positionRatio(p.position)),
          ]);
        for (const [vi, voice] of bar.voices.entries()) {
          if (voice.beats.length === 0) continue;
          f.voices?.push([...key, vi, voice.beats.length]);
          let tick = 0;
          for (const [bti, beat] of voice.beats.entries()) {
            const at = [...key, vi, bti];
            f.beatOttava?.push([...at, OTTAVA[bar.ottava ?? 'regular']]);
            const ticks = durationTicks(beat.duration);
            f.rhythm?.push([
              ...at,
              tick,
              beat.grace ? null : ticks,
              beat.duration.value,
              beat.duration.dots,
              beat.duration.tuplet?.actual ?? -1,
              beat.duration.tuplet?.normal ?? -1,
            ]);
            if (!beat.grace) tick += ticks;
            if (beat.grace) f.grace?.push([...at, beat.grace === 'onBeat' ? 1 : 2]);
            if (beat.rest) f.rests?.push(at);
            if (beat.notes.length > 1) f.chords?.push([...at, beat.notes.length]);
            for (const [ni, note] of beat.notes.entries()) {
              const n = [...at, ni];
              if (track.instrument.percussion) {
                f.percussion?.push([...n, note.pitch, note.drumTechnique ?? null]);
              } else if (staff.stringed && note.string !== undefined && note.fret !== undefined) {
                const open = staff.stringed.tuning[note.string - 1] ?? 0;
                f.pitch?.push([
                  ...n,
                  open + staff.stringed.capo + note.fret,
                  staff.stringed.tuning.length - note.string + 1,
                  note.fret,
                ]);
              } else {
                f.pitch?.push([...n, note.pitch, null, null]);
              }
              if (note.tiedFromPrevious) f.ties?.push([...n, true]);
            }
          }
        }
      }
    }
  }
  return f;
}

export interface FactDiff {
  group: string;
  expected: number;
  actual: number;
  /** Entries present on one side only (first few, for diagnosis). */
  sample: { missing: unknown[]; unexpected: unknown[] };
}

/** Compares two fact groups as multisets of JSON entries. `project` maps actual entries to the expected shape. */
export function diffGroup(
  group: string,
  expected: unknown[] = [],
  actual: unknown[] = [],
): FactDiff | null {
  const count = new Map<string, number>();
  for (const e of expected) count.set(JSON.stringify(e), (count.get(JSON.stringify(e)) ?? 0) + 1);
  const unexpected: unknown[] = [];
  for (const a of actual) {
    const k = JSON.stringify(a);
    const c = count.get(k) ?? 0;
    if (c > 0) count.set(k, c - 1);
    else unexpected.push(a);
  }
  const missing: unknown[] = [];
  for (const [k, c] of count) for (let i = 0; i < c; i++) missing.push(JSON.parse(k));
  if (missing.length === 0 && unexpected.length === 0) return null;
  return {
    group,
    expected: expected.length,
    actual: actual.length,
    sample: { missing: missing.slice(0, 5), unexpected: unexpected.slice(0, 5) },
  };
}

const TECHNIQUE_OF_ARTICULATION: Record<number, string> = {
  92: 'halfOpen',
  91: 'rimshot',
  93: 'edge',
  59: 'edge',
  95: 'choke',
  96: 'choke',
  97: 'choke',
  98: 'choke',
};

/** Maps alphaTab facts onto the shapes of `mhdFacts` (only the groups MHD semantics define). */
export function projectToMhd(f: Facts): Facts {
  const out: Facts = {};
  for (const g of [
    'trackInfo',
    'staffDisplay',
    'tuning',
    'transposition',
    'clef',
    'ottava',
    'beatOttava',
    'fermata',
    'structure',
    'timeSignature',
    'keySignature',
    'tempo',
    'anacrusis',
    'repeats',
    'alternateEndings',
    'directions',
    'sections',
    'sustainPedal',
    'voices',
    'grace',
    'rests',
    'chords',
    'ties',
  ])
    out[g] = f[g] ?? [];
  const graceAt = new Set((f.grace ?? []).map((g) => JSON.stringify((g as unknown[]).slice(0, 5))));
  out.rhythm = (f.rhythm ?? []).map((r) => {
    const a = r as number[];
    const at = a.slice(0, 5);
    const isGrace = graceAt.has(JSON.stringify(at));
    // Grace beats steal time from their neighbours in alphaTab; MHD gives them no time of their own.
    return [
      ...at,
      isGrace ? null : a[5],
      isGrace ? null : a[6],
      a[7],
      a[8],
      (a[9] ?? 0) > 0 ? a[9] : -1,
      (a[10] ?? 0) > 0 ? a[10] : -1,
    ];
  });
  out.pitch = (f.pitch ?? []).map((p) => (p as unknown[]).slice(0, 9));
  out.percussion = (f.percussion ?? []).map((p) => {
    const a = p as number[];
    return [...a.slice(0, 6), a[7], TECHNIQUE_OF_ARTICULATION[a[6] ?? -1] ?? null];
  });
  return out;
}

/** Same as `mhdFacts` but with grace beat starts hidden like `projectToMhd`. */
export function mhdComparable(doc: MhdDocument): Facts {
  const f = mhdFacts(doc);
  const graceAt = new Set((f.grace ?? []).map((g) => JSON.stringify((g as unknown[]).slice(0, 5))));
  f.rhythm = (f.rhythm ?? []).map((r) => {
    const a = r as unknown[];
    return graceAt.has(JSON.stringify(a.slice(0, 5))) ? [...a.slice(0, 5), null, ...a.slice(6)] : a;
  });
  return f;
}
