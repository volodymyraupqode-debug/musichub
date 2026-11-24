// Spike S3 (ROADMAP S2-10): latency statistics. Nearest-rank percentiles; no pooling across
// scenarios or browsers (each list is one scenario in one environment).

export interface LatencySummary {
  n: number;
  median: number;
  p95: number;
  max: number;
  min: number;
  /** Measurements strictly above the budget. */
  over: number;
  budget: number;
}

export function percentile(values: readonly number[], q: number): number {
  if (values.length === 0) throw new Error('percentile of an empty list');
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(1, Math.ceil(q * sorted.length)) - 1] as number;
}

export function summarize(values: readonly number[], budget = 150): LatencySummary {
  return {
    n: values.length,
    median: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    max: Math.max(...values),
    min: Math.min(...values),
    over: values.filter((v) => v > budget).length,
    budget,
  };
}
