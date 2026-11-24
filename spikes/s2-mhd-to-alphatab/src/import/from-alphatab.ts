// Spike S4 (ROADMAP S2-09): minimal alphaTab Score → MHD v1 converter, isolated in the spike.
// It converts the features the S4 fixtures exercise and reports everything else it finds as a
// loss; it never drops content silently. This is research code, not the Phase 1 importer
// (packages/music-engine `fromAlphaTab`), and it is never promoted as-is (spikes/README.md).
import * as alphaTab from '@coderline/alphatab';
import type {
  Bar,
  Beat,
  Duration,
  MasterBar,
  MhdDocument,
  Note,
  Staff,
  Track,
} from '@musichub/music-model';
import { idSource } from '../builders.ts';
import { DIRECTION, barTicks } from '../mapping.ts';

const { model } = alphaTab;

export interface ConversionLoss {
  /** Stable feature name, e.g. `note.accent.tenuto`. */
  feature: string;
  /** Where: `bar 1 track 0 staff 0 voice 0 beat 3 note 0`, zero-based. */
  at: string;
}

const DYNAMIC: (NonNullable<Beat['dynamic']> | undefined)[] = [
  'ppp',
  'pp',
  'p',
  'mp',
  'mf',
  'f',
  'ff',
  'fff',
];
const CLEF: Record<number, NonNullable<Bar['clef']>> = {
  0: 'neutral',
  1: 'C3',
  2: 'C4',
  3: 'F4',
  4: 'G2',
};
const DIRECTION_OF = new Map<number, NonNullable<MasterBar['direction']>>(
  Object.entries(DIRECTION).map(([k, v]) => [v, k as NonNullable<MasterBar['direction']>]),
);
const DURATIONS = new Set([1, 2, 4, 8, 16, 32, 64, 128]);

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
/** Reduced fraction of a bar for a tick offset (MHD Position). */
function position(tick: number, total: number): [number, number] {
  if (tick <= 0) return [0, 1];
  const g = gcd(tick, total);
  return [tick / g, total / g];
}

export function fromAlphaTab(
  score: alphaTab.model.Score,
  documentId: string,
): { doc: MhdDocument; losses: ConversionLoss[] } {
  const id = idSource('IM');
  const losses: ConversionLoss[] = [];
  const loss = (feature: string, at: string) => losses.push({ feature, at });

  let previous: { n: number; d: number; fifths: number; minor: boolean } | undefined;
  const masterBars: MasterBar[] = score.masterBars.map((mb, i) => {
    const at = `bar ${i}`;
    const m: MasterBar = { id: id() };
    const fifths = mb.keySignature as number;
    const minor = mb.keySignatureType === model.KeySignatureType.Minor;
    if (
      !previous ||
      previous.n !== mb.timeSignatureNumerator ||
      previous.d !== mb.timeSignatureDenominator
    )
      m.timeSignature = {
        numerator: mb.timeSignatureNumerator,
        denominator: mb.timeSignatureDenominator as NonNullable<
          MasterBar['timeSignature']
        >['denominator'],
      }; // an invalid denominator is reported by validateDocument, not hidden here
    if (!previous || previous.fifths !== fifths || previous.minor !== minor)
      m.keySignature = { fifths, mode: minor ? 'minor' : 'major' };
    previous = { n: mb.timeSignatureNumerator, d: mb.timeSignatureDenominator, fifths, minor };
    const total = barTicks({
      numerator: mb.timeSignatureNumerator,
      denominator: mb.timeSignatureDenominator,
    });
    const tempos = mb.tempoAutomations.map((a) => ({
      position: position(Math.round(a.ratioPosition * total), total),
      bpm: a.value,
      ...(a.text ? { label: a.text } : {}),
    }));
    if (i === 0 && tempos.length === 0) tempos.push({ position: [0, 1], bpm: score.tempo });
    if (tempos.length > 0) m.tempoChanges = tempos as MasterBar['tempoChanges'];
    if (mb.isRepeatStart) m.repeatStart = true;
    if (mb.repeatCount >= 2) m.repeatEnd = { count: mb.repeatCount };
    if (mb.alternateEndings > 0) {
      const endings: number[] = [];
      for (let b = 0; b < 31; b++) if (mb.alternateEndings & (1 << b)) endings.push(b + 1);
      m.alternateEndings = endings;
    }
    const directions = [...(mb.directions ?? [])];
    if (directions.length > 0) {
      const first = DIRECTION_OF.get(directions[0] as number);
      if (first) m.direction = first;
      else loss(`masterBar.direction.${directions[0]}`, at);
      for (const extra of directions.slice(1)) loss(`masterBar.direction.additional.${extra}`, at); // MHD: one per bar
    }
    if (mb.section)
      m.section = {
        ...(mb.section.marker ? { letter: mb.section.marker } : {}),
        text: mb.section.text || mb.section.marker,
      };
    if (mb.fermata && mb.fermata.size > 0) {
      const fermatas = [...mb.fermata.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([tick, f]) => ({
          position: position(tick, total),
          ...(f.type === model.FermataType.Short
            ? { type: 'short' as const }
            : f.type === model.FermataType.Long
              ? { type: 'long' as const }
              : {}),
        }));
      m.fermatas = fermatas as MasterBar['fermatas'];
    }
    if (mb.isAnacrusis) {
      if (i === 0) m.isAnacrusis = true;
      else loss('masterBar.anacrusis.notFirst', at);
    }
    if (mb.tripletFeel !== model.TripletFeel.NoTripletFeel) loss('masterBar.tripletFeel', at);
    return m;
  });

  const tracks: Track[] = score.tracks.map((t, ti) => {
    const percussion = t.staves.some((s) => s.isPercussion);
    const staves: Staff[] = t.staves.map((s, si) => {
      const stringed = s.isStringed && !percussion;
      const bars: Bar[] = s.bars.map((b, bi) => {
        const at = `bar ${bi} track ${ti} staff ${si}`;
        const bar: Bar = { id: id(), voices: [] };
        const clef = CLEF[b.clef as number];
        if (clef && (bi === 0 || b.clef !== s.bars[bi - 1]?.clef)) bar.clef = clef;
        if (b.clefOttava !== model.Ottavia.Regular) loss('bar.clefOttava', at);
        if (b.sustainPedals.length > 0) loss('bar.sustainPedal', at);
        for (const [vi, v] of b.voices.entries()) {
          if (v.isEmpty && vi > 0) continue;
          const beats: Beat[] = [];
          for (const [bti, bt] of v.beats.entries()) {
            const where = `${at} voice ${vi} beat ${bti}`;
            if (bt.isEmpty) continue;
            const duration: Duration = { value: 4, dots: 0 };
            if (DURATIONS.has(bt.duration as number))
              duration.value = bt.duration as number as Duration['value'];
            else loss(`beat.duration.${bt.duration}`, where);
            if (bt.dots > 2) loss('beat.dots.over2', where);
            duration.dots = Math.min(bt.dots, 2) as Duration['dots'];
            if (bt.hasTuplet)
              duration.tuplet = { actual: bt.tupletNumerator, normal: bt.tupletDenominator };
            const beat: Beat = { id: id(), duration, rest: bt.isRest, notes: [] };
            if (bt.graceType === model.GraceType.OnBeat) beat.grace = 'onBeat';
            else if (bt.graceType === model.GraceType.BeforeBeat) beat.grace = 'beforeBeat';
            else if (bt.graceType !== model.GraceType.None) loss('beat.grace.bend', where);
            // alphaTab gives every beat a dynamic (default F); MHD stores marks. Rule: a mark where
            // the dynamic differs from the previous beat of the voice; on the first beat, any value
            // but the default F. An explicit `f` on the first beat is therefore not recoverable.
            const before = bt.previousBeat?.dynamics ?? model.DynamicValue.F;
            if (bt.dynamics !== before) {
              const dynamic = DYNAMIC[bt.dynamics as number];
              if (dynamic) beat.dynamic = dynamic;
              else loss(`beat.dynamic.${bt.dynamics}`, where);
            }
            if (bt.text) beat.text = bt.text;
            if (bt.lyrics && bt.lyrics.length > 0) beat.lyrics = [...bt.lyrics];
            if (bt.vibrato !== model.VibratoType.None) loss('beat.vibrato', where);
            if (bt.brushType !== model.BrushType.None) loss('beat.brush', where);
            if (bt.crescendo !== model.CrescendoType.None) loss('beat.crescendo', where);
            for (const [ni, nt] of bt.notes.entries()) {
              const nAt = `${where} note ${ni}`;
              const note: Note = { id: id() };
              if (stringed && nt.string > 0) {
                note.string = s.tuning.length - nt.string + 1;
                note.fret = nt.fret;
              } else note.pitch = nt.realValue;
              if (nt.isTieDestination) note.tiedFromPrevious = true;
              const effects: NonNullable<Note['effects']> = {};
              if (nt.isStaccato) effects.staccato = true;
              if (nt.accentuated === model.AccentuationType.Normal) effects.accent = 'normal';
              else if (nt.accentuated === model.AccentuationType.Heavy) effects.accent = 'heavy';
              else if (nt.accentuated === model.AccentuationType.Tenuto)
                loss('note.accent.tenuto', nAt);
              if (Object.keys(effects).length > 0) note.effects = effects;
              if (nt.isSlurOrigin) loss('note.slur', nAt);
              if (nt.hasBend) loss('note.bend', nAt);
              if (
                nt.slideOutType !== model.SlideOutType.None ||
                nt.slideInType !== model.SlideInType.None
              )
                loss('note.slide', nAt);
              if (nt.harmonicType !== model.HarmonicType.None) loss('note.harmonic', nAt);
              if (nt.vibrato !== model.VibratoType.None) loss('note.vibrato', nAt);
              if (nt.isGhost || nt.isDead || nt.isPalmMute || nt.isLetRing || nt.isHammerPullOrigin)
                loss('note.guitarTechnique', nAt);
              if (nt.ornament !== model.NoteOrnament.None) loss('note.ornament', nAt);
              if (nt.trillValue >= 0) loss('note.trill', nAt);
              beat.notes.push(note);
            }
            beats.push(beat);
          }
          if (beats.length > 0 || vi === 0) bar.voices.push({ id: id(), beats });
        }
        return bar;
      });
      const staff: Staff = {
        id: id(),
        display: {
          standard: s.showStandardNotation,
          tab: s.showTablature,
          slash: s.showSlash,
          numbered: s.showNumbered,
        },
        bars,
      };
      if (stringed) staff.stringed = { tuning: [...s.tuning], capo: s.capo, fretCount: 24 };
      if (s.displayTranspositionPitch !== 0) staff.transpositionPitch = s.displayTranspositionPitch;
      if (s.transpositionPitch !== 0)
        loss('staff.transpositionPitch.sounding', `track ${ti} staff ${si}`);
      return staff;
    });
    return {
      id: id(),
      name: t.name.trim() || `Track ${ti + 1}`,
      color: 'track.1',
      instrument: {
        // alphaTab has no instrument family: the converter cannot know it (recorded as a loss).
        family: percussion ? 'drums' : 'other',
        midiProgram: percussion ? 0 : t.playbackInfo.program,
        percussion,
      },
      mixer: {
        volume: t.playbackInfo.volume / 16,
        pan: (t.playbackInfo.balance - 8) / 8,
        mute: t.playbackInfo.isMute,
        solo: t.playbackInfo.isSolo,
      },
      staves,
    };
  });
  if (tracks.length > 0) loss('track.instrument.family', 'all tracks');

  const doc: MhdDocument = {
    format: 'musichub',
    schemaVersion: 1,
    id: documentId,
    meta: { title: score.title || 'Untitled' },
    masterBars,
    tracks,
  };
  return { doc, losses };
}
