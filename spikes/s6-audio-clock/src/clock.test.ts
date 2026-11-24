// Spike S6 follow-up: lifecycle tests of the clock model with synthetic event streams. They test
// the model's rules, not browser or audio-output behaviour.
import { describe, expect, it } from 'vitest';
import { PlaybackClockModel, type ClockConfig, type PositionInput } from './clock.ts';

const SLEW: ClockConfig = { policy: 'slew', thresholdMs: 30, slewRate: 0.1, endScoreMs: 60_000 };
const pos = (
  t: number,
  currentTime: number,
  extra: Partial<PositionInput> = {},
): PositionInput => ({
  t,
  currentTime,
  currentTick: Math.floor(currentTime * 1.92) + 1,
  isSeek: false,
  speed: 1,
  ...extra,
});
const kinds = (c: PlaybackClockModel) => c.events.map((e) => e.kind);

describe('clock model lifecycle', () => {
  it('1. count-in: playing without a main-playback anchor holds the start position', () => {
    const c = new PlaybackClockModel(SLEW);
    c.setState(0, true, false);
    expect(c.now(500)).toEqual({ scoreMs: 0, tick: 0, state: 'waiting' });
    expect(c.now(1500).scoreMs).toBe(0); // no events during count-in: no extrapolation
  });

  it('2. the first valid anchor starts extrapolation', () => {
    const c = new PlaybackClockModel(SLEW);
    c.setState(0, true, false);
    c.position(pos(2000, 10));
    expect(c.state).toBe('playing');
    expect(kinds(c)).toEqual(['firstAnchor']);
    expect(c.now(2000).scoreMs).toBe(10);
  });

  it('3. interpolates between anchors at the playback speed', () => {
    const c = new PlaybackClockModel(SLEW);
    c.setState(0, true, false);
    c.position(pos(100, 0));
    expect(c.now(105).scoreMs).toBeCloseTo(5, 9);
    const half = new PlaybackClockModel(SLEW);
    half.setState(0, true, false);
    half.position(pos(100, 0, { speed: 0.5 }));
    expect(half.now(110).scoreMs).toBeCloseTo(5, 9); // 10 ms at speed 0.5 = 5 score ms
  });

  it('4. a correction below the threshold is slewed, without a visible jump', () => {
    const c = new PlaybackClockModel(SLEW);
    c.setState(0, true, false);
    c.position(pos(100, 0));
    const before = c.now(110).scoreMs; // 10
    c.position(pos(110, 15)); // anchor 5 ms ahead of the extrapolation
    expect(c.now(110).scoreMs).toBeCloseTo(before, 9); // continuous
    expect(c.events.at(-1)).toEqual({ kind: 'slew', t: 110, deltaMs: 5 });
    expect(c.now(160).scoreMs).toBeCloseTo(15 + 50, 9); // 5 ms absorbed after 50 ms at 10 %
    expect(c.now(140).scoreMs).toBeCloseTo(15 + 30 - 2, 9); // 3 of 5 ms absorbed
  });

  it('5. a correction exactly at the threshold snaps', () => {
    const c = new PlaybackClockModel(SLEW);
    c.setState(0, true, false);
    c.position(pos(100, 0));
    c.position(pos(110, 40)); // extrapolated 10, anchor 40: delta 30
    expect(c.events.at(-1)).toEqual({ kind: 'snap', t: 110, jumpMs: 30 });
    expect(c.now(110).scoreMs).toBe(40);
  });

  it('6. a large correction snaps (backwards too)', () => {
    const c = new PlaybackClockModel(SLEW);
    c.setState(0, true, false);
    c.position(pos(100, 0));
    c.position(pos(200, 20)); // extrapolated 100, anchor 20: delta -80 (delayed audio)
    expect(c.events.at(-1)).toEqual({ kind: 'snap', t: 200, jumpMs: -80 });
    expect(c.now(200).scoreMs).toBe(20);
  });

  it('7. an explicit seek snaps and waits for the next anchor', () => {
    const c = new PlaybackClockModel(SLEW);
    c.setState(0, true, false);
    c.position(pos(100, 0));
    c.position(pos(150, 8000, { isSeek: true }));
    expect(c.state).toBe('waiting');
    expect(c.now(150).scoreMs).toBe(8000);
    expect(c.now(180).scoreMs).toBe(8000); // held until audio resumes
    c.position(pos(190, 8010));
    expect(c.state).toBe('playing');
    expect(c.now(200).scoreMs).toBe(8020);
  });

  it('8. a speed change (alphaTab: seek with rescaled currentTime) keeps the score time', () => {
    const c = new PlaybackClockModel(SLEW);
    c.setState(0, true, false);
    c.position(pos(100, 1000));
    const shown = c.now(200).scoreMs; // 1100
    // updatePlaybackSpeed: timePosition × (old / new) → 1100 × (1 / 2) at speed 2.
    c.position(pos(200, 550, { isSeek: true, speed: 2 }));
    expect(c.now(200).scoreMs).toBeCloseTo(shown, 9);
    expect(c.events.at(-1)).toMatchObject({ kind: 'seek', jumpMs: 0 });
    c.position(pos(210, 555, { speed: 2 }));
    expect(c.now(220).scoreMs).toBeCloseTo(1110 + 20, 9); // 10 ms at speed 2
  });

  it("9. pause freezes the clock, then follows alphaTab's reset to the beat start", () => {
    const c = new PlaybackClockModel(SLEW);
    c.setState(0, true, false);
    c.position(pos(100, 0));
    c.setState(1300, false, false);
    expect(c.now(1300)).toEqual({ scoreMs: 1200, tick: 1, state: 'paused' });
    expect(c.now(2000).scoreMs).toBe(1200);
    c.position(pos(1301, 1000, { isSeek: true })); // _onPlayerStateChanged → beat start
    expect(c.now(1400)).toMatchObject({ scoreMs: 1000, state: 'paused' });
  });

  it('10. resume waits for the first anchor, then extrapolates', () => {
    const c = new PlaybackClockModel(SLEW);
    c.setState(0, true, false);
    c.position(pos(100, 0));
    c.setState(1300, false, false);
    c.position(pos(1301, 1000, { isSeek: true }));
    c.setState(5000, true, false);
    expect(c.now(5010)).toMatchObject({ scoreMs: 1000, state: 'waiting' });
    c.position(pos(5020, 1005));
    expect(c.now(5030)).toMatchObject({ scoreMs: 1015, state: 'playing' });
  });

  it('11. stop freezes, then follows the reset to the start', () => {
    const c = new PlaybackClockModel(SLEW);
    c.setState(0, true, false);
    c.position(pos(100, 0));
    c.setState(600, false, true);
    expect(c.now(700)).toMatchObject({ scoreMs: 500, state: 'stopped' });
    c.position(pos(601, 0, { isSeek: true }));
    expect(c.now(700)).toMatchObject({ scoreMs: 0, state: 'stopped' });
  });

  it('12. never runs past the end of the score', () => {
    const c = new PlaybackClockModel({ ...SLEW, endScoreMs: 1000 });
    c.setState(0, true, false);
    c.position(pos(100, 990));
    expect(c.now(150).scoreMs).toBe(1000);
  });

  it('13. loop: finished, seek to the start, restart from the next anchor', () => {
    const c = new PlaybackClockModel({ ...SLEW, endScoreMs: 1000 });
    c.setState(0, true, false);
    c.position(pos(100, 995));
    expect(c.now(200).scoreMs).toBe(1000);
    c.position(pos(201, 0, { isSeek: true })); // checkForFinish (looping): tickPosition = startTick
    expect(c.now(205)).toMatchObject({ scoreMs: 0, state: 'waiting' });
    c.position(pos(212, 3));
    expect(c.now(222).scoreMs).toBe(13);
  });

  it('14. missing or delayed events: extrapolation continues, a late anchor corrects', () => {
    const c = new PlaybackClockModel(SLEW);
    c.setState(0, true, false);
    c.position(pos(100, 0));
    expect(c.now(400).scoreMs).toBe(300); // 300 ms without events
    c.position(pos(400, 290)); // -10 ms: slewed
    expect(c.events.at(-1)).toEqual({ kind: 'slew', t: 400, deltaMs: -10 });
    c.position(pos(700, 520)); // a stall: extrapolated ≈ 600, anchor 520 → snap
    expect(c.events.at(-1)?.kind).toBe('snap');
    expect(c.now(700).scoreMs).toBe(520);
  });

  it('15. out-of-order and duplicate events are rejected', () => {
    const c = new PlaybackClockModel(SLEW);
    c.setState(0, true, false);
    c.position(pos(100, 0));
    c.position(pos(110, 10));
    c.position(pos(110, 10)); // duplicate (WebKit: 1 ms timer, recorded duplicates)
    c.position(pos(105, 5)); // older than the last accepted event
    expect(c.events.slice(-2)).toEqual([
      { kind: 'rejected', t: 110, reason: 'duplicate' },
      { kind: 'rejected', t: 105, reason: 'outOfOrder' },
    ]);
    expect(c.now(120).scoreMs).toBeCloseTo(20, 9);
  });

  it('snap policy applies every anchor and labels large corrections', () => {
    const c = new PlaybackClockModel({ ...SLEW, policy: 'snap' });
    c.setState(0, true, false);
    c.position(pos(100, 0));
    c.position(pos(110, 15));
    expect(c.now(110).scoreMs).toBe(15);
    c.position(pos(120, 60));
    expect(kinds(c)).toEqual(['firstAnchor', 'applied', 'applied', 'snap']);
  });

  it('extrapolates ticks only with a known tempo', () => {
    const c = new PlaybackClockModel(SLEW);
    c.setState(0, true, false);
    c.position(pos(100, 0, { currentTick: 1, ticksPerScoreMs: 1.92 }));
    expect(c.now(200).tick).toBeCloseTo(1 + 192, 9);
    const n = new PlaybackClockModel(SLEW);
    n.setState(0, true, false);
    n.position(pos(100, 0, { currentTick: 1 }));
    expect(n.now(200).tick).toBe(1);
  });
});
