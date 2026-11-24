// Spike S6 (ROADMAP S2-08): measurement maths for alphaTab's playback clock. Pure functions, no
// alphaTab, no DOM. Formulas are documented in docs/spikes/s6-audio-clock-accuracy.md §4.
//
// All times are milliseconds on the page's monotonic clock (`performance.now()`), except the
// player position `p`, which is alphaTab's `playerPositionChanged.currentTime`.

/** One `playerPositionChanged` event as recorded by the harness. */
export interface PositionSample {
  /** `performance.now()` when the event handler ran (main thread). */
  arrival: number;
  /** `currentTime` of the event (ms of played audio, as alphaTab counts it). */
  position: number;
  isSeek: boolean;
}

export interface Summary {
  count: number;
  median: number;
  p95: number;
  p99: number;
  max: number;
  min: number;
}

/** Nearest-rank percentile (q in 0..1) of a non-empty list. */
export function percentile(values: readonly number[], q: number): number {
  if (values.length === 0) throw new Error('percentile of an empty list');
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil(q * sorted.length));
  return sorted[rank - 1] as number;
}

export function summarize(values: readonly number[]): Summary {
  return {
    count: values.length,
    median: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
    max: Math.max(...values),
    min: Math.min(...values),
  };
}

/**
 * Expected interval between position reports (ms). alphaTab's worklet reports after at least
 * `intervalMs × sampleRate / 1000` rendered frames, checked once per 128-frame render quantum
 * (PlayedFramesAccumulator, alphaTab.core.mjs 46116); `0` reports every quantum.
 */
export function expectedInterval(intervalMs: number, sampleRate: number, quantum = 128): number {
  const frames = Math.round((intervalMs * sampleRate) / 1000);
  const quanta = frames <= 0 ? 1 : Math.ceil(frames / quantum);
  return ((quanta * quantum) / sampleRate) * 1000;
}

/** Least-squares line y = a + b·x. */
export function fitLine(xs: readonly number[], ys: readonly number[]): { a: number; b: number } {
  const n = xs.length;
  if (n < 2 || ys.length !== n) throw new Error('fitLine needs two or more points');
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i] as number;
    sy += ys[i] as number;
  }
  const mx = sx / n;
  const my = sy / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] as number) - mx;
    sxx += dx * dx;
    sxy += dx * ((ys[i] as number) - my);
  }
  const b = sxy / sxx;
  return { a: my - b * mx, b };
}

const abs = (v: number) => Math.abs(v);
const centred = (values: readonly number[]) => {
  const m = percentile(values, 0.5);
  return values.map((v) => v - m);
};

export interface IntervalMetrics {
  expected: number;
  interval: Summary;
  deviation: Summary;
  /** Intervals longer than 1.5 × expected (at least one report slot late or missing). */
  delayed: number;
  /** Sum of `round(Δa / expected) − 1` over delayed intervals: report slots without an event. */
  missedSlots: number;
}

/** Inter-arrival intervals Δaᵢ = aᵢ − aᵢ₋₁ and their deviation |Δaᵢ − E| from the expected E. */
export function intervalMetrics(
  samples: readonly PositionSample[],
  expected: number,
): IntervalMetrics {
  const intervals: number[] = [];
  for (let i = 1; i < samples.length; i++)
    intervals.push(
      (samples[i] as PositionSample).arrival - (samples[i - 1] as PositionSample).arrival,
    );
  const delayedIntervals = intervals.filter((d) => d > 1.5 * expected);
  return {
    expected,
    interval: summarize(intervals),
    deviation: summarize(intervals.map((d) => abs(d - expected))),
    delayed: delayedIntervals.length,
    missedSlots: delayedIntervals.reduce((n, d) => n + Math.round(d / expected) - 1, 0),
  };
}

export interface AnchorMetrics {
  /** Fitted arrival = intercept + slope · position (ms per ms of position). */
  intercept: number;
  slope: number;
  /** Position advance per ms of page time (1 / slope). */
  rate: number;
  /** (rate / nominalRate − 1) · 10⁶. */
  driftPpm: number;
  /** driftPpm · duration: position error accumulated over the run by a fixed-rate clock (ms). */
  driftOverRunMs: number;
  durationMs: number;
  /** |rᵢ − median(r)| with rᵢ = aᵢ − (intercept + slope · pᵢ): arrival jitter around the audio timeline. */
  jitter: Summary;
}

/**
 * Anchor jitter. The position counts audio frames the worklet consumed, which advance at the
 * audio hardware rate; the arrival time adds message passing (worklet → main → synth worker →
 * main) and main-thread delay. A line fitted through (pᵢ, aᵢ) removes the constant offset (any
 * fixed latency) and the rate difference (drift); the residuals are the arrival jitter.
 */
export function anchorMetrics(
  samples: readonly PositionSample[],
  nominalRate: number,
): AnchorMetrics {
  const fit = fitLine(
    samples.map((s) => s.position),
    samples.map((s) => s.arrival),
  );
  const residuals = samples.map((s) => s.arrival - (fit.a + fit.b * s.position));
  const rate = 1 / fit.b;
  const durationMs =
    (samples[samples.length - 1] as PositionSample).arrival -
    (samples[0] as PositionSample).arrival;
  const driftPpm = (rate / nominalRate - 1) * 1e6;
  return {
    intercept: fit.a,
    slope: fit.b,
    rate,
    driftPpm,
    driftOverRunMs: (driftPpm / 1e6) * durationMs * nominalRate,
    durationMs,
    jitter: summarize(centred(residuals).map(abs)),
  };
}

export type ClockModel = 'raw' | 'interpolated' | 'regression';

/**
 * Clock value at page time t from the events received before t:
 * - raw: pₖ of the last event k with aₖ ≤ t (what a consumer sees without interpolation);
 * - interpolated: pₖ + (t − aₖ) · rate (MUSIC_ENGINE.md §5.1, without slew and latency terms);
 * - regression: a line fitted through the events of the last `windowMs`, evaluated at t.
 */
export function clockAt(
  model: ClockModel,
  samples: readonly PositionSample[],
  lastIndex: number,
  t: number,
  rate: number,
  windowMs = 500,
): number {
  const last = samples[lastIndex] as PositionSample;
  if (model === 'raw') return last.position;
  if (model === 'interpolated') return last.position + (t - last.arrival) * rate;
  let first = lastIndex;
  while (first > 0 && last.arrival - (samples[first - 1] as PositionSample).arrival <= windowMs)
    first--;
  if (lastIndex - first < 2) return last.position + (t - last.arrival) * rate;
  const window = samples.slice(first, lastIndex + 1);
  const fit = fitLine(
    window.map((s) => s.arrival),
    window.map((s) => s.position),
  );
  return fit.a + fit.b * t;
}

export interface ClockError {
  /** median(eⱼ): constant offset of the model against the reference (not jitter). */
  bias: number;
  /** |eⱼ − bias|. */
  error: Summary;
}

/**
 * Error eⱼ = C(tⱼ) − T(tⱼ) of a clock model at query times tⱼ (rAF frames), against the
 * reference timeline T(t) = (t − intercept) / slope from `anchorMetrics`. This is the error
 * against the audio-frame timeline of the player, not against sound at the speaker (loopback).
 */
export function clockError(
  model: ClockModel,
  samples: readonly PositionSample[],
  queries: readonly number[],
  anchor: Pick<AnchorMetrics, 'intercept' | 'slope'>,
  rate: number,
  windowMs = 500,
): ClockError {
  const errors: number[] = [];
  let k = -1;
  for (const t of queries) {
    while (k + 1 < samples.length && (samples[k + 1] as PositionSample).arrival <= t) k++;
    if (k < 0) continue;
    if (k === samples.length - 1 && t > (samples[k] as PositionSample).arrival + 50) continue;
    const reference = (t - anchor.intercept) / anchor.slope;
    errors.push(clockAt(model, samples, k, t, rate, windowMs) - reference);
  }
  const bias = percentile(errors, 0.5);
  return { bias, error: summarize(errors.map((e) => abs(e - bias))) };
}

/** Samples in the steady state: no seek, from `skipMs` after the first event to `tailMs` before the last. */
export function steadyState(
  samples: readonly PositionSample[],
  skipMs = 1000,
  tailMs = 500,
): PositionSample[] {
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last) return [];
  return samples.filter(
    (s) => !s.isSeek && s.arrival >= first.arrival + skipMs && s.arrival <= last.arrival - tailMs,
  );
}

// ---------------------------------------------------------------------------------------------
// Loopback (manual measurement): onsets recorded from the audio input in the player's own
// AudioContext, compared with the clock that should show the note at that moment.

export interface LoopbackResult {
  matched: number;
  /** median(errₖ): fixed latency of output + input + acoustic path (not separable here). */
  latency: number;
  /** |errₖ − latency|: jitter of the visual clock against the sound actually recorded. */
  jitter: Summary;
}

/**
 * errₖ = Tₖ − qₖ: for every recorded onset at page time tₖ, the clock model's value at tₖ
 * minus the score time qₖ of the nearest note (notes every `noteMs`, first at 0). Positive
 * errors mean the clock is ahead of the sound.
 */
export function loopbackErrors(
  model: ClockModel,
  samples: readonly PositionSample[],
  onsetTimes: readonly number[],
  noteMs: number,
  rate: number,
): LoopbackResult {
  const errors: number[] = [];
  let k = -1;
  for (const t of onsetTimes) {
    while (k + 1 < samples.length && (samples[k + 1] as PositionSample).arrival <= t) k++;
    if (k < 0) continue;
    const clock = clockAt(model, samples, k, t, rate);
    const note = Math.round(clock / noteMs) * noteMs;
    errors.push(clock - note);
  }
  const latency = percentile(errors, 0.5);
  return {
    matched: errors.length,
    latency,
    jitter: summarize(errors.map((e) => abs(e - latency))),
  };
}

/**
 * Converts AudioContext times (s) to page times (ms) with a line fitted through pairs
 * (contextTime s, performance.now() ms) sampled on the main thread. The fitted offset contains
 * the sampling delay; it is constant and therefore part of the loopback latency, not jitter.
 */
export function contextToPage(
  pairs: readonly (readonly [number, number])[],
  contextTimes: readonly number[],
): number[] {
  const fit = fitLine(
    pairs.map((p) => p[0]),
    pairs.map((p) => p[1]),
  );
  return contextTimes.map((c) => fit.a + fit.b * c);
}

/** Histogram of values in bins of `width` ms: [lower bound, count]; the last bin holds everything ≥ `max`. */
export function histogram(
  values: readonly number[],
  width: number,
  max: number,
): [number, number][] {
  const bins = Math.ceil(max / width);
  const counts = new Array<number>(bins + 1).fill(0);
  for (const v of values) {
    const i = v >= max ? bins : Math.max(0, Math.floor(v / width));
    counts[i] = (counts[i] ?? 0) + 1;
  }
  return counts.map((c, i) => [Math.round(i * width * 1000) / 1000, c] as [number, number]);
}

/**
 * Slow wander of the timeline: per `binMs` bin the smallest residual rᵢ (the least delayed event,
 * a lower envelope), and the range max − min of those minima. White delivery jitter leaves the
 * minima flat; a wandering audio clock moves them.
 */
export function wander(
  samples: readonly PositionSample[],
  anchor: Pick<AnchorMetrics, 'intercept' | 'slope'>,
  binMs = 1000,
): { bins: number; range: number } {
  const first = samples[0];
  if (!first) return { bins: 0, range: 0 };
  const minima = new Map<number, number>();
  for (const s of samples) {
    const bin = Math.floor((s.arrival - first.arrival) / binMs);
    const r = s.arrival - (anchor.intercept + anchor.slope * s.position);
    minima.set(bin, Math.min(minima.get(bin) ?? Infinity, r));
  }
  const values = [...minima.values()];
  return { bins: values.length, range: Math.max(...values) - Math.min(...values) };
}

/** |residual| p95 of a line through (contextTime ms, performance.now()) pairs: audio clock wander as read on the main thread. */
export function contextClockResidual(pairs: readonly (readonly [number, number])[]): number {
  const xs = pairs.map((p) => p[0] * 1000);
  const ys = pairs.map((p) => p[1]);
  const fit = fitLine(xs, ys);
  return percentile(
    ys.map((y, i) => Math.abs(y - (fit.a + fit.b * (xs[i] as number)))),
    0.95,
  );
}
