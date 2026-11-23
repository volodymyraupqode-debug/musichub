// Headless rendering with alphaTab's ScoreRenderer (SVG engine, Node). The same renderer runs in
// the browser worker; Node output is used here as reproducible evidence (no browser needed).
import * as alphaTab from '@coderline/alphatab';

export interface RenderSummary {
  svg: string;
  /** Rendered master bars, bar bounds (one per drawn notation line), and distinct beats and notes with bounds. */
  masterBars: number;
  bars: number;
  beats: number;
  notes: number;
  error?: string;
  ms: number;
}

export function renderScore(
  score: alphaTab.model.Score,
  settings: alphaTab.Settings,
  width = 1300,
): RenderSummary {
  settings.core.includeNoteBounds = true;
  const renderer = new alphaTab.rendering.ScoreRenderer(settings);
  renderer.width = width;
  const parts: string[] = [];
  let error: string | undefined;
  renderer.partialRenderFinished.on((r) => {
    if (typeof r.renderResult === 'string') parts.push(r.renderResult);
  });
  renderer.error.on((e) => {
    error = e.message;
  });
  const t0 = performance.now();
  renderer.renderScore(
    score,
    score.tracks.map((t) => t.index),
  );
  const ms = performance.now() - t0;
  const lookup = renderer.boundsLookup;
  let masterBars = 0;
  let bars = 0;
  // A staff drawn as notation + tab has bounds per drawn line: count distinct model objects.
  const beatSet = new Set<object>();
  const noteSet = new Set<object>();
  for (const system of lookup?.staffSystems ?? []) {
    for (const mb of system.bars) {
      masterBars++;
      for (const bar of mb.bars) {
        bars++;
        for (const beat of bar.beats) {
          if (beat.beat.isEmpty) continue;
          beatSet.add(beat.beat);
          for (const n of beat.notes ?? []) noteSet.add(n.note);
        }
      }
    }
  }
  const beats = beatSet.size;
  const notes = noteSet.size;
  // Stack the partial SVGs vertically into one document.
  let y = 0;
  const body = parts
    .map((p) => {
      const h = Number(/height="([\d.]+)px"/.exec(p)?.[1] ?? 0);
      const g = `<g transform="translate(0 ${y})">${p}</g>`;
      y += h;
      return g;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}" viewBox="0 0 ${width} ${y}">${body}</svg>`;
  return { svg, masterBars, bars, beats, notes, ms, ...(error ? { error } : {}) };
}
