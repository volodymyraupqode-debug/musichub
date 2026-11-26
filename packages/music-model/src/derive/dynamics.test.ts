// Effective dynamics: default f, carried per staff and voice number in score order (ADR-0002 A23).
import { describe, expect, it } from 'vitest';
import type { Beat, Staff } from '../schema/document.js';
import { bar, beat, deepFreeze, note, pitchStaff, rest, testId } from '../test-support/builders.js';
import { DEFAULT_DYNAMIC, effectiveDynamics } from './dynamics.js';

const q = (dynamic?: Beat['dynamic']): Beat =>
  beat(4, [note({ pitch: 60 })], dynamic ? { dynamic } : {});
const dynamicsOf = (staff: Staff, beats: Beat[]) => {
  const map = effectiveDynamics(staff);
  return beats.map((b) => map.get(b.id));
};

describe('effectiveDynamics', () => {
  it('defaults to f before the first mark', () => {
    expect(DEFAULT_DYNAMIC).toBe('f');
    const beats = [q(), q(), q('p'), q()];
    expect(dynamicsOf(pitchStaff([bar(beats)]), beats)).toEqual(['f', 'f', 'p', 'p']);
  });

  it('carries a mark across bars within the voice', () => {
    const one = [q(), q(), q(), q('mp')];
    const two = [q(), q(), q('ff'), q()];
    expect(dynamicsOf(pitchStaff([bar(one), bar(two)]), [...one, ...two])).toEqual([
      'f',
      'f',
      'f',
      'mp',
      'mp',
      'mp',
      'ff',
      'ff',
    ]);
  });

  it('keeps voices of a staff independent', () => {
    const upper = [q('pp'), q(), q(), q()];
    const lower = [beat(2, [note({ pitch: 48 })]), beat(2, [note({ pitch: 50 })])];
    const staff = pitchStaff([
      {
        id: testId(),
        voices: [
          { id: testId(), beats: upper },
          { id: testId(), beats: lower },
        ],
      },
    ]);
    expect(dynamicsOf(staff, [...upper, ...lower])).toEqual(['pp', 'pp', 'pp', 'pp', 'f', 'f']);
  });

  it('keeps staves independent (grand staff)', () => {
    const upper = [q('p'), q(), q(), q()];
    const lower = [q(), q(), q(), q()];
    expect(dynamicsOf(pitchStaff([bar(upper)]), upper)).toEqual(['p', 'p', 'p', 'p']);
    expect(dynamicsOf(pitchStaff([bar(lower)]), lower)).toEqual(['f', 'f', 'f', 'f']);
  });

  it('carries through rests and grace beats, and a mark on a rest applies onwards', () => {
    const grace = beat(16, [note({ pitch: 61 })], { grace: 'beforeBeat' });
    const restWithMark: Beat = { ...rest(4), dynamic: 'mf' };
    const beats = [q('p'), grace, rest(4), restWithMark, q()];
    expect(dynamicsOf(pitchStaff([bar(beats)]), beats)).toEqual(['p', 'p', 'p', 'mf', 'mf']);
  });

  it('continues a voice that is absent in some bars from its last occurrence (Q2)', () => {
    const v0 = [
      [q(), q(), q(), q()],
      [q(), q(), q(), q()],
      [q(), q(), q(), q()],
    ];
    const v1First = [beat(1, [note({ pitch: 72 })], { dynamic: 'pp' })];
    const v1Later = [beat(1, [note({ pitch: 74 })])];
    const staff = pitchStaff([
      {
        id: testId(),
        voices: [
          { id: testId(), beats: v0[0] ?? [] },
          { id: testId(), beats: v1First },
        ],
      },
      { id: testId(), voices: [{ id: testId(), beats: v0[1] ?? [] }] },
      {
        id: testId(),
        voices: [
          { id: testId(), beats: v0[2] ?? [] },
          { id: testId(), beats: v1Later },
        ],
      },
    ]);
    expect(dynamicsOf(staff, [...v1First, ...v1Later])).toEqual(['pp', 'pp']);
    expect(dynamicsOf(staff, v0[2] ?? [])).toEqual(['f', 'f', 'f', 'f']);
  });

  it('uses score order: a repeat does not rewind the dynamic (Q3)', () => {
    // |: A(p) B :| C — on the second pass A still has its own mark; B and C carry p in score order.
    const beats = [q('p'), q(), q(), q()];
    const staff = pitchStaff([bar(beats.slice(0, 2)), bar(beats.slice(2))]);
    expect(dynamicsOf(staff, beats)).toEqual(['p', 'p', 'p', 'p']);
  });

  it('does not change the staff', () => {
    const beats = [q(), q('ff')];
    const staff = deepFreeze(pitchStaff([bar(beats)]));
    effectiveDynamics(staff);
    expect(staff.bars[0]?.voices[0]?.beats[0]?.dynamic).toBeUndefined();
  });
});
