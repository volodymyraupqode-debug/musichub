// Spike S5: event-by-event comparison of prototype and reference MIDI events.
//
// Matching, per event type, in this order (each step only sees what earlier steps left):
// 1. exact: same track, tick, key, channel and velocity;
// 2. channel / velocity mismatch: same track, tick and key;
// 3. ordering mismatch: per track, the remaining ticks and keys are equal as multisets but paired
//    differently (the same notes in a different order);
// 4. pitch mismatch: same track and tick, different key;
// 5. timing mismatch: same track and key, nearest tick;
// 6. missing (only in the reference) / extra (only in the prototype).
// A pair or leftover becomes "unsupported" when the prototype flagged the note's construct as not
// modelled (see prototype.ts), even if the pair happens to match exactly: an unmodelled construct
// is no evidence of parity. A reference leftover within the tick span of such notes is unsupported
// too. Unsupported events are excluded from the note-on parity denominator.
// No normalisation other than the MHD track id is applied: ticks, keys, channels and velocities
// are compared as integers.
import type { EventType, TimelineEvent } from './prototype.ts';

export type Category =
  | 'exact'
  | 'channel'
  | 'velocity'
  | 'pitch'
  | 'ordering'
  | 'timing'
  | 'missing'
  | 'extra'
  | 'unsupported';

export interface Finding {
  category: Category;
  type: EventType;
  reference?: TimelineEvent;
  prototype?: TimelineEvent;
}

export interface Comparison {
  counts: Record<EventType, Record<Category, number>>;
  findings: Finding[];
  /** Exact note-ons / reference note-ons, excluding those classified unsupported. */
  noteOnParity: { exact: number; comparable: number };
}

const CATEGORIES: Category[] = [
  'exact',
  'channel',
  'velocity',
  'pitch',
  'ordering',
  'timing',
  'missing',
  'extra',
  'unsupported',
];

function emptyCounts(): Record<Category, number> {
  return Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
}

/** Removes and returns pairs whose keys are equal, as a multiset match. */
function pairBy(
  refs: TimelineEvent[],
  protos: TimelineEvent[],
  keyOf: (e: TimelineEvent) => string,
): [TimelineEvent, TimelineEvent][] {
  const pool = new Map<string, TimelineEvent[]>();
  for (const p of protos) {
    const k = keyOf(p);
    pool.set(k, [...(pool.get(k) ?? []), p]);
  }
  const pairs: [TimelineEvent, TimelineEvent][] = [];
  const restRefs: TimelineEvent[] = [];
  for (const r of refs) {
    const candidates = pool.get(keyOf(r));
    const p = candidates?.shift();
    if (p) pairs.push([r, p]);
    else restRefs.push(r);
  }
  refs.splice(0, refs.length, ...restRefs);
  protos.splice(0, protos.length, ...[...pool.values()].flat());
  return pairs;
}

function compareNotes(
  type: EventType,
  reference: TimelineEvent[],
  prototype: TimelineEvent[],
  findings: Finding[],
): void {
  const refs = reference.filter((e) => e.type === type);
  const protos = prototype.filter((e) => e.type === type);
  const add = (category: Category, r?: TimelineEvent, p?: TimelineEvent) =>
    findings.push({
      category: p?.unsupported ? 'unsupported' : category,
      type,
      ...(r ? { reference: r } : {}),
      ...(p ? { prototype: p } : {}),
    });

  for (const [r, p] of pairBy(
    refs,
    protos,
    (e) => `${e.trackId}|${e.tick}|${e.key}|${e.channel}|${e.velocity}`,
  ))
    add('exact', r, p);
  for (const [r, p] of pairBy(refs, protos, (e) => `${e.trackId}|${e.tick}|${e.key}`))
    add(r.channel !== p.channel ? 'channel' : 'velocity', r, p);

  // Ordering: same notes per track, but in a different order in time.
  const tracks = new Set([...refs, ...protos].map((e) => e.trackId));
  for (const track of tracks) {
    const r = refs.filter((e) => e.trackId === track);
    const p = protos.filter((e) => e.trackId === track);
    const sorted = (list: TimelineEvent[], f: (e: TimelineEvent) => number) =>
      list
        .map(f)
        .sort((a, b) => a - b)
        .join();
    if (
      r.length > 0 &&
      r.length === p.length &&
      sorted(r, (e) => e.tick) === sorted(p, (e) => e.tick) &&
      sorted(r, (e) => e.key ?? -1) === sorted(p, (e) => e.key ?? -1)
    ) {
      const byTick = (a: TimelineEvent, b: TimelineEvent) =>
        a.tick - b.tick || (a.key ?? 0) - (b.key ?? 0);
      const rs = [...r].sort(byTick);
      const ps = [...p].sort(byTick);
      rs.forEach((e, i) => add('ordering', e, ps[i]));
      for (const e of r) refs.splice(refs.indexOf(e), 1);
      for (const e of p) protos.splice(protos.indexOf(e), 1);
    }
  }

  for (const [r, p] of pairBy(refs, protos, (e) => `${e.trackId}|${e.tick}`)) add('pitch', r, p);

  // Timing: same track and key, nearest tick.
  for (const r of [...refs]) {
    const candidates = protos.filter((p) => p.trackId === r.trackId && p.key === r.key);
    if (candidates.length === 0) continue;
    const p = candidates.reduce((a, b) =>
      Math.abs(a.tick - r.tick) <= Math.abs(b.tick - r.tick) ? a : b,
    );
    add('timing', r, p);
    refs.splice(refs.indexOf(r), 1);
    protos.splice(protos.indexOf(p), 1);
  }

  const flaggedSpans = prototype.filter((e) => e.type === type && e.unsupported);
  for (const r of refs) {
    const near = flaggedSpans.some(
      (p) => p.trackId === r.trackId && Math.abs(p.tick - r.tick) <= 960,
    );
    findings.push({ category: near ? 'unsupported' : 'missing', type, reference: r });
  }
  for (const p of protos) add('extra', undefined, p);
}

function compareTempo(
  reference: TimelineEvent[],
  prototype: TimelineEvent[],
  findings: Finding[],
): void {
  const refs = reference.filter((e) => e.type === 'tempo');
  const protos = prototype.filter((e) => e.type === 'tempo');
  const round = (n: number | undefined) => Math.round((n ?? 0) * 1e6) / 1e6;
  for (const [r, p] of pairBy(refs, protos, (e) => `${round(e.tick)}|${round(e.bpm)}`))
    findings.push({ category: 'exact', type: 'tempo', reference: r, prototype: p });
  for (const [r, p] of pairBy(refs, protos, (e) => `${round(e.bpm)}`))
    findings.push({ category: 'timing', type: 'tempo', reference: r, prototype: p });
  for (const r of refs) findings.push({ category: 'missing', type: 'tempo', reference: r });
  for (const p of protos) findings.push({ category: 'extra', type: 'tempo', prototype: p });
}

export function compareEvents(reference: TimelineEvent[], prototype: TimelineEvent[]): Comparison {
  const findings: Finding[] = [];
  compareNotes('noteOn', reference, prototype, findings);
  compareNotes('noteOff', reference, prototype, findings);
  compareTempo(reference, prototype, findings);
  const counts = { noteOn: emptyCounts(), noteOff: emptyCounts(), tempo: emptyCounts() };
  for (const f of findings) counts[f.type][f.category]++;
  const on = counts.noteOn;
  const comparable = CATEGORIES.filter((c) => c !== 'unsupported' && c !== 'extra').reduce(
    (n, c) => n + on[c],
    0,
  );
  return { counts, findings, noteOnParity: { exact: on.exact, comparable } };
}
