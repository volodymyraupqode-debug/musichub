# Spike S6 — Audio clock accuracy

Throw-away research code for ROADMAP.md S2-08 (MUSIC_ENGINE.md §5.1, §10 spike S6). Report:
[docs/spikes/s6-audio-clock-accuracy.md](../../docs/spikes/s6-audio-clock-accuracy.md).

- `src/analysis.ts` — measurement maths (intervals, anchor jitter, drift, clock models, loopback); tested in `src/analysis.test.ts`.
- `harness/index.html` — plain-HTML page with alphaTab 1.9.0 that records every `playerPositionChanged`, animation frame and AudioContext time; `harness/server.ts` serves it.
- `e2e/smoke.spec.ts` — short browser check (`pnpm test:browser`); `e2e/measure.spec.ts` — the measurement plan (`pnpm measure --project=chromium --project=webkit`, ~27 min). Neither runs in CI.
- `scripts/analyze.ts` — `pnpm analyze`: metrics of every file in `data/raw/` and `data/loopback/` → `data/summary.json`, `data/summary.md`.
- `scripts/serve.ts` — `pnpm serve`: the harness on http://127.0.0.1:3280/ for manual and loopback runs (none of which was performed in S2-08; see the report §8).

`data/raw/` holds the raw runs (gzip JSON, with configuration and environment); `data/measure-run.log` the Playwright log of the measurement session.
