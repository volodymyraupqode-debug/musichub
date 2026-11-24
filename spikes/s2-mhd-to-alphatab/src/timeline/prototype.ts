// Spike S5 (ROADMAP S2-06): independent MIDI event prototype from MHD.
// Input: MHD + the adapter's channel plan (adapter policy, channels.ts). It must not import alphaTab
// and never reads alphaTab output (checked by a test). Rules follow MUSIC_ENGINE.md §3.6 (risk R6:
// the timeline must match alphaTab's MIDI generation); each alphaTab-parity rule is marked [AT]
// and was taken from the alphaTab 1.9.0 source (MidiFileGenerator, Voice/Beat.finish, MidiUtils).
import type {
  Beat,
  Duration,
  MasterBar,
  MhdDocument,
  Note,
  Staff,
  Track,
} from '@musichub/music-model';
import type { ChannelPlan } from '../channels.ts';
import { playbackOrder } from './playback-order.ts';

export type EventType = 'noteOn' | 'noteOff' | 'tempo';

export interface TimelineEvent {
  type: EventType;
  tick: number;
  trackId?: string;
  channel?: number;
  key?: number;
  velocity?: number;
  bpm?: number;
  /** Prototype only: MHD note id and the construct that makes the event unreliable, if any. */
  noteId?: string;
  unsupported?: string;
}

export interface PrototypeResult {
  events: TimelineEvent[];
  /** Constructs found in the document that the prototype does not model. */
  unsupported: string[];
  assumptions: string[];
}

const QUARTER = 960;

/** [AT] MidiUtils.valueToTicks / applyDot / applyTuplet, integer arithmetic with truncation. */
export function beatTicks(d: Duration): number {
  let ticks = Math.trunc((QUARTER * 4) / d.value);
  if (d.dots === 2) ticks = ticks + Math.trunc(ticks / 4) * 3;
  else if (d.dots === 1) ticks = ticks + Math.trunc(ticks / 2);
  if (d.tuplet) ticks = Math.trunc((ticks * d.tuplet.normal) / d.tuplet.actual);
  return ticks;
}

export function timeSignatureTicks(ts: { numerator: number; denominator: number }): number {
  return ts.numerator * Math.trunc((QUARTER * 4) / ts.denominator);
}

/** [AT] Grace beats: playback length from the grace group size (1 → 120, 2 → 60, ≥ 3 → 30 ticks). */
function graceTicks(groupSize: number): number {
  return groupSize === 1 ? 120 : groupSize === 2 ? 60 : 30;
}

interface TimedBeat {
  beat: Beat;
  start: number;
  duration: number;
}

/**
 * [AT] Voice.finish: beats are laid out in order; a before-beat grace group takes its time from the
 * previous beat of the voice (also across the bar line: negative start in this bar); an on-beat
 * grace group starts at the main beat's position and delays the main beat. A lone whole rest fills
 * the bar.
 */
function layoutVoice(
  beats: readonly Beat[],
  barTicks: number,
  previous: TimedBeat | undefined,
): TimedBeat[] {
  const out: TimedBeat[] = [];
  let tick = 0;
  let group: TimedBeat[] = [];
  for (const beat of beats) {
    if (beat.grace) {
      group.push({ beat, start: tick, duration: 0 });
      continue;
    }
    let duration =
      beat.rest && beats.length === 1 && beat.duration.value === 1
        ? barTicks
        : beatTicks(beat.duration);
    if (group.length > 0) {
      const each = graceTicks(group.length);
      const stolen = each * group.length;
      if (group[0]?.beat.grace === 'beforeBeat') {
        const before = out.at(-1) ?? previous;
        if (before) before.duration -= stolen;
        let t = out.at(-1) ? tick - stolen : -stolen;
        for (const g of group) {
          g.start = t;
          g.duration = each;
          t += each;
        }
      } else {
        let t = tick;
        for (const g of group) {
          g.start = t;
          g.duration = each;
          t += each;
        }
        duration -= stolen;
        tick += stolen;
      }
      out.push(...group);
      group = [];
    }
    out.push({ beat, start: tick, duration });
    tick += duration;
  }
  for (const g of group) {
    g.start = tick;
    g.duration = graceTicks(group.length);
    out.push(g);
  }
  return out;
}

const DYNAMIC: Record<string, number> = { ppp: 0, pp: 1, p: 2, mp: 3, mf: 4, f: 5, ff: 6, fff: 7 };

function soundingPitch(staff: Staff, note: Note): number | undefined {
  if (staff.stringed && note.string !== undefined && note.fret !== undefined) {
    const open = staff.stringed.tuning[note.string - 1];
    return open === undefined ? undefined : open + staff.stringed.capo + note.fret;
  }
  return note.pitch;
}

function unsupportedNoteOn(beat: Beat, note: Note, barHasTripletFeel: boolean): string | undefined {
  if (note.effects?.harmonic) return 'harmonic';
  if (note.effects?.trill) return 'trill';
  if (beat.effects?.tremoloPicking) return 'tremolo picking';
  if (beat.effects?.brush) return 'brush';
  if (note.effects?.slideOut === 'legato') return 'legato slide';
  if (barHasTripletFeel) return 'triplet feel';
  return undefined;
}

function unsupportedNoteOff(note: Note): string | undefined {
  const fx = note.effects;
  if (fx?.deadNote) return 'dead note length';
  if (fx?.palmMute) return 'palm mute length';
  if (fx?.letRing) return 'let ring length';
  if (fx?.slideOut || fx?.slideIn) return 'slide length';
  return undefined;
}

export function prototypeEvents(doc: MhdDocument, plan: ChannelPlan): PrototypeResult {
  const order = playbackOrder(doc.masterBars);
  const unsupported = new Set<string>();
  const assumptions = new Set(order.assumptions);
  const events: TimelineEvent[] = [];

  // Bar lengths. [AT] A pickup bar lasts as long as its longest voice (MasterBar.calculateDuration).
  let ts = { numerator: 4, denominator: 4 };
  const nominal = doc.masterBars.map((mb) => {
    if (mb.timeSignature) ts = mb.timeSignature;
    return timeSignatureTicks(ts);
  });

  // Lay out every staff bar once (score positions, independent of playback order).
  type Layout = Map<string, TimedBeat[]>; // key: track/staff/bar/voice
  const layout: Layout = new Map();
  const key = (t: number, s: number, b: number, v: number) => `${t}/${s}/${b}/${v}`;
  doc.tracks.forEach((track, ti) =>
    track.staves.forEach((staff, si) => {
      const voiceCount = Math.max(...staff.bars.map((b) => b.voices.length));
      for (let v = 0; v < voiceCount; v++) {
        let previous: TimedBeat | undefined;
        staff.bars.forEach((bar, bi) => {
          const beats = bar.voices[v]?.beats ?? [];
          const timed = layoutVoice(beats, nominal[bi] ?? 3840, previous);
          layout.set(key(ti, si, bi, v), timed);
          const last = timed.filter((x) => !x.beat.grace).at(-1);
          if (last) previous = last;
        });
      }
    }),
  );
  const barLength = doc.masterBars.map((mb, bi) => {
    if (!mb.isAnacrusis) return nominal[bi] ?? 3840;
    let max = 0;
    for (const [k, timed] of layout) {
      if (Number(k.split('/')[2]) !== bi || timed.length === 0) continue;
      const first = timed[0];
      const last = timed.at(-1);
      if (first && last) max = Math.max(max, last.start + last.duration - first.start);
    }
    return max;
  });
  // Linear score start of each master bar (used by alphaTab for tie lengths).
  const scoreStart: number[] = [];
  barLength.reduce((acc, len, i) => ((scoreStart[i] = acc), acc + len), 0);

  // Playback start tick of every occurrence.
  let tick = 0;
  const occurrences = order.bars.map((o) => {
    const start = tick;
    tick += barLength[o.bar] ?? 0;
    return { ...o, start };
  });

  // [AT] Tempo events: every played occurrence of a bar with tempo changes emits them, at the
  // position measured against the nominal (time-signature) bar length; bar 0 without one gets the
  // score tempo.
  for (const o of occurrences) {
    const mb: MasterBar | undefined = doc.masterBars[o.bar];
    for (const tc of mb?.tempoChanges ?? [])
      events.push({
        type: 'tempo',
        tick: o.start + ((nominal[o.bar] ?? 0) * tc.position[0]) / tc.position[1],
        bpm: tc.bpm,
      });
  }

  const channelOf = new Map(plan.tracks.map((t) => [t.trackId, t.playback]));
  const dynamics = new Map<string, number>(); // velocity dynamic per note id, adapter convention
  const hammerDestinations = new Set<string>();
  const legatoTargets = new Set<string>();
  const tieInfo = new Map<string, { origin: boolean; destination: boolean }>();

  doc.tracks.forEach((track: Track, ti) =>
    track.staves.forEach((staff, si) => {
      // Adapter convention (strategy-a buildStaff): the dynamic starts at f and is carried through
      // bars and voices in document order.
      let dynamic = DYNAMIC.f ?? 5;
      staff.bars.forEach((bar) =>
        bar.voices.forEach((voice) =>
          voice.beats.forEach((beat) => {
            if (beat.dynamic) dynamic = DYNAMIC[beat.dynamic] ?? dynamic;
            for (const n of beat.notes) dynamics.set(n.id, dynamic);
          }),
        ),
      );
      // Ties and hammer-ons: the next note on the same string / pitch in the next beat of the voice.
      const voiceCount = Math.max(...staff.bars.map((b) => b.voices.length));
      for (let v = 0; v < voiceCount; v++) {
        const beats = staff.bars.flatMap((b) => (b.voices[v]?.beats ?? []).filter((x) => !x.grace));
        beats.forEach((b, i) => {
          const next = beats[i + 1];
          for (const n of b.notes) {
            const same = next?.notes.find((m) =>
              staff.stringed ? m.string === n.string : m.pitch === n.pitch,
            );
            if (same?.tiedFromPrevious) {
              tieInfo.set(n.id, {
                origin: true,
                destination: tieInfo.get(n.id)?.destination ?? false,
              });
              tieInfo.set(same.id, {
                origin: tieInfo.get(same.id)?.origin ?? false,
                destination: true,
              });
            }
            if (n.effects?.hammerPullOrigin && same && !track.instrument.percussion)
              hammerDestinations.add(same.id);
            // [AT] the target of a legato slide gets no note-on of its own (not modelled: flagged)
            const sameString = next?.notes.find(
              (m) => m.string !== undefined && m.string === n.string,
            );
            if (n.effects?.slideOut === 'legato' && sameString) legatoTargets.add(sameString.id);
          }
        });
      }
      void ti;
      void si;
    }),
  );

  // Absolute score tick and length of every note's beat, for tie lengths.
  const noteBeat = new Map<
    string,
    { absStart: number; duration: number; note: Note; next?: string }
  >();
  doc.tracks.forEach((track, ti) =>
    track.staves.forEach((staff, si) => {
      const voiceCount = Math.max(...staff.bars.map((b) => b.voices.length));
      for (let v = 0; v < voiceCount; v++) {
        staff.bars.forEach((_, bi) => {
          for (const tb of layout.get(key(ti, si, bi, v)) ?? [])
            for (const n of tb.beat.notes)
              noteBeat.set(n.id, {
                absStart: (scoreStart[bi] ?? 0) + tb.start,
                duration: tb.duration,
                note: n,
              });
        });
        // link tie chains
        const beats = staff.bars.flatMap((b) => (b.voices[v]?.beats ?? []).filter((x) => !x.grace));
        beats.forEach((b, i) => {
          for (const n of b.notes) {
            const next = beats[i + 1]?.notes.find((m) =>
              staff.stringed ? m.string === n.string : m.pitch === n.pitch,
            );
            const info = noteBeat.get(n.id);
            if (info && next?.tiedFromPrevious) info.next = next.id;
          }
        });
      }
    }),
  );
  /** [AT] _getNoteDuration: tie origin lasts until the end of its tie destination (recursively). */
  const soundLength = (noteId: string, ownDuration: number): number => {
    const info = noteBeat.get(noteId);
    if (!info) return ownDuration;
    if (info.note.effects?.staccato) return Math.trunc(ownDuration / 2);
    if (info.next) {
      const dest = noteBeat.get(info.next);
      if (dest) return dest.absStart + soundLength(info.next, dest.duration) - info.absStart;
    }
    return ownDuration;
  };

  // Tick shift. [AT] _detectTickShift: a negative start in the first played bar shifts everything.
  let shift = 0;
  const first = occurrences[0];
  if (first)
    for (const [k, timed] of layout) {
      if (Number(k.split('/')[2]) !== first.bar) continue;
      const s = timed[0]?.start ?? 0;
      if (s < shift) shift = s;
    }
  shift = Math.abs(shift);

  for (const o of occurrences) {
    doc.tracks.forEach((track, ti) => {
      const channels = channelOf.get(track.id);
      if (!channels) return; // not in the Playback Score
      const mb = doc.masterBars[o.bar];
      const tripletFeel = mb?.tripletFeel !== undefined && mb.tripletFeel !== 'none';
      track.staves.forEach((staff, si) => {
        const voiceCount = Math.max(...staff.bars.map((b) => b.voices.length));
        for (let v = 0; v < voiceCount; v++) {
          for (const tb of layout.get(key(ti, si, o.bar, v)) ?? []) {
            const beat = tb.beat;
            if (beat.rest) continue;
            for (const note of beat.notes) {
              if (tieInfo.get(note.id)?.destination) continue; // [AT] no note-on for a tie destination
              const pitch = soundingPitch(staff, note);
              if (pitch === undefined) continue;
              // [AT] notes with bend, whammy or beat vibrato use the secondary channel
              const secondary = Boolean(
                note.effects?.bend || beat.effects?.whammy || beat.effects?.vibrato,
              );
              let adjust = 0;
              if (hammerDestinations.has(note.id)) adjust--;
              if (note.effects?.ghost) adjust--;
              if (note.effects?.accent === 'normal') adjust++;
              if (note.effects?.accent === 'heavy') adjust += 2;
              const velocity = Math.min(
                Math.max(15 + 16 * (dynamics.get(note.id) ?? 5) + 16 * adjust, 1),
                127,
              );
              const start = o.start + tb.start + shift;
              const onReason = legatoTargets.has(note.id)
                ? 'legato slide target'
                : unsupportedNoteOn(beat, note, tripletFeel);
              const offReason = onReason ?? unsupportedNoteOff(note);
              if (onReason) unsupported.add(onReason);
              if (offReason) unsupported.add(offReason);
              const base = {
                trackId: track.id,
                channel: secondary ? channels.secondary : channels.primary,
                key: pitch,
                velocity,
                noteId: note.id,
              };
              events.push({
                type: 'noteOn',
                tick: start,
                ...base,
                ...(onReason ? { unsupported: onReason } : {}),
              });
              events.push({
                type: 'noteOff',
                tick: start + soundLength(note.id, tb.duration),
                ...base,
                ...(offReason ? { unsupported: offReason } : {}),
              });
            }
          }
        }
      });
    });
  }
  // [AT] The first played bar's tempo events are written before _detectTickShift runs, so only
  // later tempo events are shifted.
  const firstBar = occurrences[0];
  if (shift !== 0 && firstBar)
    for (const e of events)
      if (e.type === 'tempo' && e.tick >= firstBar.start + (barLength[firstBar.bar] ?? 0))
        e.tick += shift;
  return { events, unsupported: [...unsupported], assumptions: [...assumptions] };
}
