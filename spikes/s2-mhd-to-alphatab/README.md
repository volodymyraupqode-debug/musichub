# Spike S2 — MHD → alphaTab (Strategy A vs B)

Throw-away research code for ROADMAP.md S2-05 (MUSIC_ENGINE.md §4.1, §10 spike S2). Report and recommendation: [docs/spikes/s2-mhd-to-alphatab.md](../../docs/spikes/s2-mhd-to-alphatab.md).

- `src/strategy-a.ts` — build the alphaTab model directly, then `score.finish(settings)`.
- `src/strategy-b.ts` — generate alphaTex and import it with `ScoreLoader.loadAlphaTex`.
- `src/facts.ts`, `src/midi.ts`, `src/render.ts` — compare the results with MHD and with each other.

Node only, except the S7 browser experiment (`pnpm test:browser`). Requires a built `@musichub/music-model`.

```bash
pnpm test      # both strategies on all documents, alphaTab findings, id map
pnpm compare   # comparison table, results/compare.json, generated alphaTex
pnpm bench     # 300 × 8 benchmark
pnpm render    # screenshots of A and B (Playwright Chromium); --docs updates docs/spikes/
```

`src/timeline/` holds spike S5 (ROADMAP.md S2-06): an independent MHD playback-order and MIDI-event prototype compared with alphaTab's `MidiFileGenerator` on the Playback Score. Report: [docs/spikes/s5-timeline-parity.md](../../docs/spikes/s5-timeline-parity.md). Run it with `pnpm exec vitest run src/timeline`.

`src/playback-variants/` and `e2e/` hold spike S7 (ROADMAP.md S2-07): playing a Playback Score while alphaTab renders a different Render Score, through a `midiLoad` hook. Report: [docs/spikes/s7-playback-score-variants.md](../../docs/spikes/s7-playback-score-variants.md). Node evidence runs in `pnpm test` (`pnpm exec vitest run src/playback-variants`); the browser experiment with the real `AlphaTabApi` runs by hand with `pnpm test:browser` (Playwright Chromium and WebKit; not part of `turbo run test` or CI). `pnpm s7:serve` serves the harness on http://127.0.0.1:3270/ for the manual checklist in the report.

`src/import/` and `fixtures/import/` hold spike S4 (ROADMAP.md S2-09): import fidelity of original hand-authored MusicXML fixtures through alphaTab → MHD (a spike-only converter) → GP7 round trip. Report: [docs/spikes/s4-import-fidelity.md](../../docs/spikes/s4-import-fidelity.md); fixture provenance and checksums: `fixtures/import/SOURCES.md`. Tests run in `pnpm test`; `pnpm import-fidelity` prints the coverage matrix.

`src/edit-loop/` and `e2e/edit-loop*` hold spike S3 (ROADMAP.md S2-10): edit-loop latency of the real adapter, S7 hook and `AlphaTabApi` in Playwright Chromium and WebKit. Report: [docs/spikes/s3-edit-loop-latency.md](../../docs/spikes/s3-edit-loop-latency.md). The smoke test runs in `pnpm test:browser`; measurements with `S3_MEASURE=1 pnpm exec playwright test e2e/edit-loop-measure.spec.ts --workers=1`, then `pnpm edit-loop-analyze` (raw data and summaries in `data/edit-loop/`); `pnpm edit-loop-node` times the stages in Node.

`results/` is generated and git-ignored. Production code never imports this package.
