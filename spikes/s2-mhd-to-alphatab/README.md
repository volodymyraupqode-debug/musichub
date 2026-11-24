# Spike S2 — MHD → alphaTab (Strategy A vs B)

Throw-away research code for ROADMAP.md S2-05 (MUSIC_ENGINE.md §4.1, §10 spike S2). Report and recommendation: [docs/spikes/s2-mhd-to-alphatab.md](../../docs/spikes/s2-mhd-to-alphatab.md).

- `src/strategy-a.ts` — build the alphaTab model directly, then `score.finish(settings)`.
- `src/strategy-b.ts` — generate alphaTex and import it with `ScoreLoader.loadAlphaTex`.
- `src/facts.ts`, `src/midi.ts`, `src/render.ts` — compare the results with MHD and with each other.

Node only (no browser). Requires a built `@musichub/music-model`.

```bash
pnpm test      # both strategies on all documents, alphaTab findings, id map
pnpm compare   # comparison table, results/compare.json, generated alphaTex
pnpm bench     # 300 × 8 benchmark
pnpm render    # screenshots of A and B (Playwright Chromium); --docs updates docs/spikes/
```

`src/timeline/` holds spike S5 (ROADMAP.md S2-06): an independent MHD playback-order and MIDI-event prototype compared with alphaTab's `MidiFileGenerator` on the Playback Score. Report: [docs/spikes/s5-timeline-parity.md](../../docs/spikes/s5-timeline-parity.md). Run it with `pnpm exec vitest run src/timeline`.

`results/` is generated and git-ignored. Production code never imports this package.
