// Spike S6 follow-up: research model of an audio-anchored playback clock (MUSIC_ENGINE.md §5.1)
// with a correction policy, for offline replay of the recorded alphaTab 1.9.0 events. Pure
// TypeScript, no DOM, no alphaTab. NOT production code: Phase 1 builds `PlaybackClock` in
// `packages/music-engine`.
//
// Units (alphaTab 1.9.0, verified in alphaTab.core.mjs):
// - `currentTime` (playerPositionChanged) is playback time at the current speed: the sequencer's
//   time position, which `updatePlaybackSpeed` rescales by old/new speed on a speed change
//   (core 44133–44137, a seek). Score time on alphaTab's timeline = currentTime × playbackSpeed
//   (score milliseconds, the song's own tempo map, speed 1). This is the time anchor.
// - `currentTick` = floor((currentTime × speed − tempoChange.time) / msPerTick) + tempoChange.ticks
//   + 1 (`currentTimePositionToTickPosition`, core 40660–40668): an integer, truncated, offset by
//   one tick. Converting it to time needs the tempo map. The tick anchor is tracked separately and
//   extrapolated only when the caller supplies the tempo (ticks per score millisecond).
// - Event times `t` are `performance.now()` on the page when the handler ran.

export type ClockState = 'stopped' | 'waiting' | 'playing' | 'paused';
export type Policy = 'snap' | 'slew';

export interface ClockConfig {
  /**
   * `snap`: every anchor is applied immediately (plain interpolation; the threshold only labels
   * corrections at or above it). `slew`: corrections below the threshold are absorbed gradually,
   * corrections at or above it snap.
   */
  policy: Policy;
  /** Threshold in playback milliseconds (score ms / speed). */
  thresholdMs: number;
  /** Slew rate: playback ms of correction absorbed per playback ms elapsed (0.1 = 10 %). */
  slewRate: number;
  /** End of the score in score milliseconds; the clock never runs past it. */
  endScoreMs?: number;
}

export interface PositionInput {
  t: number;
  currentTime: number;
  currentTick: number;
  isSeek: boolean;
  /** playbackSpeed in force when the event was produced. */
  speed: number;
  /** Ticks per score millisecond at the anchor (from the tempo map), if known. */
  ticksPerScoreMs?: number;
}

export type ClockEvent =
  | { kind: 'firstAnchor'; t: number }
  | { kind: 'seek'; t: number; jumpMs: number }
  | { kind: 'snap'; t: number; jumpMs: number }
  | { kind: 'slew'; t: number; deltaMs: number }
  | { kind: 'applied'; t: number; deltaMs: number }
  | { kind: 'rejected'; t: number; reason: 'outOfOrder' | 'duplicate' };

interface Anchor {
  t: number;
  scoreMs: number;
  tick: number;
  speed: number;
  ticksPerScoreMs?: number;
}

export class PlaybackClockModel {
  state: ClockState = 'stopped';
  readonly events: ClockEvent[] = [];
  private anchor: Anchor | undefined;
  /** Display minus base at `offsetT` (score ms); decays toward 0 under the slew policy. */
  private offset = 0;
  private offsetT = 0;
  /** Value shown while not extrapolating (stopped, paused, waiting). */
  private held = { scoreMs: 0, tick: 0 };
  private lastEventT = -Infinity;
  private lastInput: PositionInput | undefined;

  readonly config: ClockConfig;

  constructor(config: ClockConfig) {
    this.config = config;
  }

  /** playerStateChanged: playing, paused (stopped = false) or stopped (stopped = true). */
  setState(t: number, playing: boolean, stopped: boolean): void {
    if (playing) {
      if (this.state !== 'playing') this.state = 'waiting'; // extrapolate only after a new anchor
      return;
    }
    this.held = this.read(t);
    this.anchor = undefined;
    this.offset = 0;
    this.state = stopped ? 'stopped' : 'paused';
  }

  position(e: PositionInput): void {
    if (e.t < this.lastEventT) {
      this.events.push({ kind: 'rejected', t: e.t, reason: 'outOfOrder' });
      return;
    }
    const last = this.lastInput;
    if (last && !e.isSeek && last.currentTime === e.currentTime && last.speed === e.speed) {
      this.events.push({ kind: 'rejected', t: e.t, reason: 'duplicate' });
      return;
    }
    this.lastEventT = e.t;
    this.lastInput = e;
    const scoreMs = e.currentTime * e.speed;
    const next: Anchor = {
      t: e.t,
      scoreMs,
      tick: e.currentTick,
      speed: e.speed,
      ...(e.ticksPerScoreMs !== undefined ? { ticksPerScoreMs: e.ticksPerScoreMs } : {}),
    };
    const shown = this.read(e.t).scoreMs;
    if (e.isSeek) {
      this.events.push({ kind: 'seek', t: e.t, jumpMs: (scoreMs - shown) / e.speed });
      this.held = { scoreMs, tick: e.currentTick };
      this.anchor = undefined;
      this.offset = 0;
      if (this.state === 'playing') this.state = 'waiting'; // audio restarts from the new position
      return;
    }
    if (this.state === 'stopped' || this.state === 'paused') {
      this.held = { scoreMs, tick: e.currentTick };
      return;
    }
    if (this.state === 'waiting' || !this.anchor) {
      this.anchor = next;
      this.offset = 0;
      this.offsetT = e.t;
      this.state = 'playing';
      this.events.push({ kind: 'firstAnchor', t: e.t });
      return;
    }
    const base = scoreMs; // the new anchor's value at e.t
    const deltaMs = (base - shown) / e.speed;
    if (this.config.policy === 'snap') {
      this.events.push({ kind: 'applied', t: e.t, deltaMs });
      if (Math.abs(deltaMs) >= this.config.thresholdMs)
        this.events.push({ kind: 'snap', t: e.t, jumpMs: deltaMs });
      this.anchor = next;
      this.offset = 0;
      this.offsetT = e.t;
      return;
    }
    if (Math.abs(deltaMs) >= this.config.thresholdMs) {
      this.events.push({ kind: 'snap', t: e.t, jumpMs: deltaMs });
      this.anchor = next;
      this.offset = 0;
      this.offsetT = e.t;
      return;
    }
    this.events.push({ kind: 'slew', t: e.t, deltaMs });
    this.anchor = next;
    this.offset = shown - base; // continuous: display unchanged at e.t
    this.offsetT = e.t;
  }

  /** Clock value at page time t (score milliseconds and ticks). */
  now(t: number): { scoreMs: number; tick: number; state: ClockState } {
    return { ...this.read(t), state: this.state };
  }

  private read(t: number): { scoreMs: number; tick: number } {
    const a = this.anchor;
    if (this.state !== 'playing' || !a) return { ...this.held };
    const elapsed = Math.max(0, t - a.t);
    let scoreMs = a.scoreMs + elapsed * a.speed + this.decayedOffset(t, a.speed);
    const end = this.config.endScoreMs;
    if (end !== undefined && scoreMs > end) scoreMs = end;
    const tick =
      a.ticksPerScoreMs !== undefined ? a.tick + (scoreMs - a.scoreMs) * a.ticksPerScoreMs : a.tick;
    return { scoreMs, tick };
  }

  private decayedOffset(t: number, speed: number): number {
    if (this.offset === 0) return 0;
    const absorbed = this.config.slewRate * Math.max(0, t - this.offsetT) * speed;
    const remaining = Math.max(0, Math.abs(this.offset) - absorbed);
    return Math.sign(this.offset) * remaining;
  }
}
