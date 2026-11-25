# MusicHub — Roadmap

> Status: Draft v0.2 (audited 2026‑11‑21) — awaiting approval. The order follows the required strategy: **web first → music engine before advanced editing → editor before community → mobile after web → AI after initial release.** Durations are rough estimates for a small team (1–2 developers + AI agents). They will be re-estimated after Phase 0. Sprints are 2 weeks.
>
> **Changelog v0.2.33:** S4 owner disposition recorded (2026‑11‑25, ADR-0002 Amendment 7, A17; Option 2): the S4 criterion is unchanged and not met; Phase 1 owns the production importer, coverage matrix, golden round-trip tests on legally usable MusicXML fixtures, the three recorded import deviations, the tenuto/slur/transposing-key MHD questions and the GP7 stringed-staff finding; Phase 7 owns independent GP3–GP8 evidence before v1.0. Owner decision 3 struck through; S2-09 status unchanged; S7 disposition pending; Phase 0 not complete. The Phase 1 exit criterion on GP7 export in third-party apps is unchanged and recorded as an open verification risk.
>
> **Changelog v0.2.32:** S3 owner disposition recorded (2026‑11‑25, ADR-0002 Amendment 6, A16; Option B + D): the S3 gap is placed in Phase 3 (Editor), measured there under the unchanged A9 with the real `editor-core` and RenderScheduler on 300 × 8; Phase 1 gets an architecture constraint (keep a partial Render Score, off-main-thread conversion and MIDI regeneration on play feasible). Owner decision 2 struck through; S3 remains technically not met (S2-10 status unchanged); S4 and S7 dispositions pending; Phase 0 not complete.
>
> **Changelog v0.2.31:** S5 owner decisions recorded (2026‑11‑25, ADR-0002 Amendment 5, MUSIC_ENGINE.md v0.2.5): D1 keeps MHD invariant 7 with an implicit Playback Score `repeatStart` (not yet verified); D2 rejected by a new validation invariant; the timeline reports the MHD hi-hat key (42 + halfOpen stays 42, documented alphaTab exception); [CONV] 1–3 adopted; at most one segno and one coda; default dynamic open until MHD v1 finalisation. Owner decision 4 (S5) is struck through as decided; the S5 pass criterion is not met yet (Phase 1 parity tests). Phase 0 stays not complete (S3, S4, S7 open). S2-06 status unchanged.
>
> **Changelog v0.2.30:** Q0 decided by the owner (2026‑11‑25, Option C): Phase 0 is complete when the three exit criteria are met **and** the owner has recorded a disposition for each open MUSIC_ENGINE.md §10 gap (S3, S4, S5, S7); a disposition does not mean the original criterion was met. The three criteria are met; the four dispositions are pending, so Phase 0 is not complete. Stale S6 and recording statements in §Phase 0 and §Sprint 2 corrected; no criterion, measurement or spike status changed.
>
> **Changelog v0.2.29:** S6 audio clock fallback accepted by the owner (2026‑11‑25, ADR-0004 Addendum 2) on the evidence of the offline replay (`9b21fe8`); S2-08 is done through fallback selection, Phase 0 exit criterion 3 is met through its fallback alternative, and the 10 ms target remains unmet. Phase 0 is not declared complete (Q0 open). S3, S4, S5, S7 unchanged.
>
> **Changelog v0.2.28:** Phase 0 exit criterion 1 (clean clone) verified 2026‑11‑25: the literal `pnpm dev` and the corrected README web step (`pnpm turbo run dev --filter=@musichub/web`) pass from an isolated clean clone. The S6 criterion and the other spike results are unchanged; Phase 0 is not complete.
>
> **Changelog v0.2.27:** S2-12 (approved 2026‑11‑24): Phase 0 evidence consolidation and exit-criteria audit. ADR-0002 Amendment 4 records the S2, S4 and S5 results (findings only); MUSIC_ENGINE.md §10 gets a results table; §Phase 0 gets an exit-status checklist. S2-08, S2-09, S2-10 stay partly done; S2-11 and S2-13 stay TBD; Phase 0 is not complete.
>
> **Changelog v0.2.26:** S3 acceptance criterion defined by the owner (ADR-0002 Amendment 3, A9): single-edit interval from edit command to the first painted frame, p95 < 150 ms on 300 × 8, with sample-size, environment, MIDI-readiness and fallback rules. S2-10 stays partly done (target not met, no fallback selected); Phase 0 is not complete.
>
> **Changelog v0.2.25:** S2-10 (spike S3) partly done: edit-loop latency measured in Playwright Chromium and WebKit; < 150 ms met for small documents only, no fallback reaches it on 300 × 8 and none is selected; numbers in ADR-0002 Amendment 3 (*Deferred*). S2-08 and S2-09 keep their statuses; Phase 0 is not complete.
>
> **Changelog v0.2.24:** S2-09 extended to 14 hand-authored MusicXML fixtures (multiple parts, grace notes, percussion, a transposing instrument, lyrics, a compressed `.mxl`). The owner cannot provide Guitar Pro files: GP3–GP8 stay not evaluated, as a test-data gap, not a compatibility result. S2-09 stays partly done; the S4 criterion is not met; Phase 0 is not complete.
>
> **Changelog v0.2.23:** S2-09 (spike S4) partly done: 8 hand-authored MusicXML fixtures, a spike alphaTab → MHD converter and a first coverage matrix; GP3–GP5 and public-domain MusicXML wait for owner approval of tools and sources, GP6–GP8 not evaluated. The S4 criterion is not met; Phase 0 is not complete.
>
> **Changelog v0.2.22:** S2-09 (spike S4) started. OQ2 (options B + D: no Guitar Pro purchase; TuxGuitar for verified GP3–GP5 exports; hand-authored and individually verified public-domain MusicXML; GP6–GP8 not evaluated) and OQ3 (no alphaTab test-data files) recorded in §Sprint 2. The S4 criterion is unchanged; Phase 0 is not complete.
>
> **Changelog v0.2.21:** S2-08 (spike S6) partly done: the automated part is complete and documented; loopback, Safari and Firefox measurements are outside the current scope (owner decision), so the Phase 0 clock criterion stays unverified and Phase 0 is not complete. ADR-0004 gets a *Deferred* addendum; no clock decision is taken.
>
> **Changelog v0.2.20:** S2-08 (spike S6) in progress: automated player-event clock measurements recorded (Chromium meets p95 < 10 ms, headless WebKit does not at the default interval); loopback, Safari and Firefox pending. The Phase 0 clock criterion is not verified; Phase 0 is not complete.
>
> **Changelog v0.2.19:** S2-07 (spike S7) done: the Render/Playback Score separation is kept with alphaTab's `midiLoad` event as the playback hook (ADR-0002 Amendment 2). S2-08…S2-10 stay planned; Phase 0 is not complete.
>
> **Changelog v0.2.18:** Sprint 2 status corrected: S2-05 (spike S2, PRs #10–#13) and S2-06 (spike S5, PR #14) are done. S2-07 (spike S7, playback-score variants) is in review; S2-08 (S6), S2-09 (S4) and S2-10 (S3) are planned. Completed spikes are not Phase 0 exit criteria; Phase 0 is not complete.
>
> **Changelog v0.2.17:** S2-05 follow-up, decisions Q-D and Q-E (MUSIC_ENGINE.md §3.2): `Bar.ottava` is a display-only octave line over the current bar; `MasterBar.fermata` is replaced by positioned `fermatas`. Implemented in `music-model` (schema, validation, JSON Schema, `band-repeats` fixture) and in spike S2. S2-06 stays TBD; Phase 0 is not complete.
>
> **Changelog v0.2.16:** ADR-0004 (alphaTab under Turbopack) accepted with documented limitations after spike S1.
>
> **Changelog v0.2.15:** S2-04 done: Firefox passed the manual check (owner); spike S1 verified in Chromium, WebKit (Playwright), Safari and Firefox.
>
> **Changelog v0.2.14:** S2-04: Safari passed the manual check (owner); Firefox verification still open.
>
> **Changelog v0.2.13:** S2-04 defined as spike S1 (alphaTab in Next.js 16 + Turbopack, `spikes/s1-turbopack`); automated checks done, manual Safari/Firefox verification pending.
>
> **Changelog v0.2.12:** S2-03 done: three canonical MHD v1 fixtures (guitar, piano grand staff with pedal, band with repeats) with expected-result sidecars and fixture tests in `packages/music-model`. S2-04…S2-13 stay TBD.
>
> **Changelog v0.2.11:** Sprint 2 formalised (§Sprint 2): S2-00…S2-02 recorded as done, S2-03 planned, S2-04…S2-13 TBD. The design-token skeleton is removed from Sprint 2 and stays in Phase 1 (decision C1).
>
> **Changelog v0.2.10:** S2-00 CI verification recorded in S1-10: the PR trigger and red checks (lint, test, codegen drift) are confirmed on GitHub; merge protection on `main` is not configured yet; intermittent SeaweedFS start failures in the `php` job are listed as technical debt.
>
> **Changelog v0.2.9:** Sprint 1 closed: first GitHub Actions run green on `main` (`3e19d87`, run 45060685119).
>
> **Changelog v0.2.8:** Sprint 1 reconciliation. Statuses re-checked against the code; Q22 (SeaweedFS); OpenAPI response validation and the Compose `full` profile moved to Phase 4; technical debt listed.
>
> **Changelog v0.2.7:** Sprint 1 statuses updated after implementation.
>
> **Changelog v0.2.6:** Q20/Q21: optional MIDI-guitar spike S8 in Phase 2 (no v1 commitment); Phase 9 split into 9a learning system design, 9b Audio/AI and 9c other deferred items.
>
> **Changelog v0.2.5:** Q16: local practice outbox in Phase 2, server sync in Phase 4, data export in Phase 7, synced progress on mobile.
>
> **Changelog v0.2.4:** the mobile audio/MIDI prototype becomes Phase 2M, right after Phase 2 (owner decision). Phase 8 keeps a short re-check (8.0) before development (8.1).
>
> **Changelog v0.2.3:** Phase 8 split into 8.0 (mandatory mobile audio/MIDI prototype gate) and 8.1 (development).
>
> **Changelog v0.2.2:** Q2b approved; pending markers on Sprint 1 tasks removed.
>
> **Changelog v0.2.1:** Q2/Q11 decisions applied (shadcn/ui, Zustand, React Hook Form; Expo confirmed). Sprint 1 tasks that use Q2b tooling are marked.
>
> **Changelog v0.2:**
> - Phase 0 is split into Sprint 1 (foundation, §Sprint 1) and Sprint 2 (spikes).
> - Practice mode joins Phase 2.
> - Server-side import and `music-worker` move from Phase 4 to Phase 8; Phase 4 uses client-side import + uploads.
> - Added spike S7.
> - The T0.x backlog from v0.1 is replaced by Sprint 1 tasks. T0.1 was completed as part of S1-01…S1-04.

Each phase has exit criteria. A phase is done only when all of them are met and the docs are updated.

## Phase 0 — Foundation & spikes (≈ 4 weeks, Sprints 1–2)

**Sprint 1, foundation:** see §Sprint 1. No music functionality.

**Sprint 2, spikes and model draft:** see §Sprint 2.
- Spikes S1–S7 (MUSIC_ENGINE.md §10) in `spikes/`; results recorded in ADR‑0002 and ADR‑0004.
- MHD v1 schema draft in `music-model` (types + Zod + invariants), 3 hand-written fixtures (guitar, piano grand staff with pedal, band with repeats/endings).
- Legally usable import fixtures (own or public-domain GP3–8 and MusicXML files).

**Exit:**
- `pnpm install && pnpm dev` and `docker compose up` work from a clean clone; CI is green.
- Spike numbers are recorded and the `toAlphaTab` strategy is decided.
- S6 clock jitter < 10 ms, or a fallback is chosen.

**Exit status (2026‑11‑24, S2-12; criteria above unchanged):**

| Exit criterion | Status | Evidence | Missing / blocking |
|---|---|---|---|
| `pnpm install && pnpm dev` and `docker compose up` work from a clean clone; CI is green | **Met** (verified 2026‑11‑25) | CI green on `main` `51b6443` (JS, PHP, E2E jobs). Clean-clone recheck below: `pnpm install --frozen-lockfile`, `docker compose up -d --wait` and the literal `pnpm dev` pass; web app HTTP 200 with "API: ok", spike S1 HTTP 200 | Verified on one macOS machine with a warm pnpm store and an isolated compose project name; not a cold network install |
| Spike numbers are recorded and the `toAlphaTab` strategy is decided | Met for the recording, with gaps in the evidence itself | Strategy A decided (ADR-0002 A1); every spike's numbers and status recorded (ADR-0002 Amendments 1–4, ADR-0004 and its Addendum; index in ADR-0002 Amendment 4) | Recorded results include unmet spike criteria: S3, S4 partly done; S5 semantics decided 2026‑11‑25 (ADR-0002 Amendment 5), parity under them still to be shown in Phase 1; S7 sustain pedal and hand split not covered; S6 decided through the fallback (criterion 3), its MUSIC_ENGINE.md §10 pass criterion unverified |
| S6 clock jitter < 10 ms, or a fallback is chosen | **Met through the fallback alternative** (owner decision 2026‑11‑25) | Fallback chosen and recorded in ADR-0004 Addendum 2 and MUSIC_ENGINE.md §5.1; evidence: offline replay of the 18 S6 runs (`spikes/s6-audio-clock/REPLAY.md`, commit `9b21fe8`). The 10 ms target itself is unchanged and **not** met: headless WebKit exceeds it at the default interval in 3 of 4 speed-1.0 runs; at interval 0 the worst WebKit p99 is 9.54 ms (3 runs) | Accepted limitations: no physical output loopback; no real Safari, Firefox, mobile or other hardware; historical browser-clock data against the player's own audio-frame timeline; CPU/message cost of interval 0 not measured; speed changes, pauses, loops and count-in covered by synthetic tests only; output latency and calibration (Phase 2) unverified; the policy must be implemented and verified in Phase 1 |

Clean-clone check (2026‑11‑24, S2-12), in an isolated scratch directory: local clone of `main` at `c8afcea`; Node 26.13.1, pnpm 12.21.0; services under a separate compose project name (`-p s212-clean-clone`, because `infra/docker-compose.yml` pins the project name `musichub`, which would reuse the owner's existing containers and volumes); Composer and artisan under `php84` (Herd note in README.md). All isolated containers and volumes were removed afterwards; the owner's containers, volumes and running servers were not touched.

| Step (README.md *Quick start*) | Result |
|---|---|
| `pnpm install --frozen-lockfile` | pass (warm pnpm store on this machine, not a cold network install) |
| `docker compose -f infra/docker-compose.yml up -d --wait` (+ `-p s212-clean-clone`) and `run --rm seaweedfs-init` | pass: postgres, redis, mailpit, seaweedfs healthy; bucket `musichub-local` ready |
| `composer install`, `cp .env.example .env`, `artisan key:generate`, `artisan migrate` | pass |
| `artisan serve --port 8000`, `GET /api/v1/health` | pass: HTTP 200, database ok, redis ok |
| `composer test` | pass: 10 Pest tests, 60 assertions (isolated PostgreSQL, Redis, SeaweedFS) |
| `pnpm dev` (exit criterion) | **not verified**: the spike S1 dev server failed with `EADDRINUSE :3200` because the owner's own S1 dev server was running on this machine; Turbo then stopped the whole run, including the web app. The owner's server was not stopped |
| `cp apps/web/.env.example apps/web/.env.local && pnpm --filter @musichub/web dev` | **fails**: HTTP 500, `Module not found: Can't resolve '@musichub/api-client'`; the package exports `dist/`, which a clean clone has not built, and this command does not build workspace dependencies. Documentation finding, not fixed in S2-12 |
| `pnpm turbo run dev --filter=@musichub/web` (builds `^build` first) | pass: HTTP 200, the page shows "API: ok" |

Clean-clone recheck (2026‑11‑25), after the README fix of the web step; isolated scratch clone of branch `docs/phase0-clean-clone-dev` at `bd6a38e` (= `main` `51b6443` + README/AGENTS.md change), compose project `phase0-clean-clone`, `php84`, Node 26.13.1, pnpm 12.21.0. Port :3200 was freed by the owner for the `pnpm dev` run. The owner's containers, volumes and servers were not touched; the isolated containers, network, volumes and clone were removed afterwards.

| Step | Result |
|---|---|
| `pnpm install --frozen-lockfile` | pass (`packages/api-client/dist` absent afterwards: 0 files) |
| `docker compose -f infra/docker-compose.yml up -d --wait` (+ `-p phase0-clean-clone`), `run --rm seaweedfs-init` | pass |
| API steps of README.md, `GET /api/v1/health` | pass: HTTP 200, database ok, redis ok |
| README web step `cp apps/web/.env.example apps/web/.env.local && pnpm turbo run dev --filter=@musichub/web` | pass: Turbo builds `api-client` first (`dist`: 4 files); `GET http://localhost:3000/` HTTP 200, page shows "API: ok" |
| `pnpm dev` (literal, repository root; exit criterion) | pass: Turbo runs dev in 7 packages; `GET http://localhost:3000/` HTTP 200 with "API: ok", `GET http://localhost:3200/` (spike S1) HTTP 200 |

Owner decisions needed before Phase 0 can be declared complete (none is taken by S2-12):

1. ~~**S6:** a clock fallback, or measurements against the audio output~~ — decided 2026‑11‑25: fallback accepted (ADR-0004 Addendum 2).
2. ~~**S3:** a fallback under ADR-0002 A9's policy, or work on the unmeasured options for large scores, with new A9-conformant measurements~~ — decided 2026‑11‑25 (ADR-0002 Amendment 6, A16; Option B + D): The S3 gap is placed in Phase 3 (Editor). ADR-0002 A9 remains unchanged; S3 remains technically not met. In Phase 3, with the real `editor-core` and RenderScheduler, the edit loop must be measured under A9 on the 300 × 8 reference document. S3 closes only through an A9 pass or an A9-compliant fallback explicitly selected and accepted by the owner. Phase 1's `toAlphaTab`, render-controller and Playback Score architecture must not preclude a partial Render Score, off-main-thread conversion, or MIDI regeneration on play. This resolves S3's owner disposition under Q0, not the S3 technical criterion.
3. ~~**S4:** how to treat the missing GP3–GP8 evidence (criterion not met)~~ — decided 2026‑11‑25 (ADR-0002 Amendment 7, A17; Option 2): S4 remains technically not met; the original criterion is unchanged. Phase 1 owns the production importer, coverage matrix and golden round-trip tests using legally usable MusicXML fixtures; the three recorded import deviations; the MHD questions concerning tenuto, slur and transposing key signature; and the GP7 stringed-staff finding. Phase 7 (Hardening & Web v1.0 launch) owns independent GP3–GP8 import evidence using legally usable fixtures under OQ2/OQ3, before v1.0. If no such fixtures are available by then, the owner will decide how Guitar Pro import is presented at launch. Missing GP evidence is not evidence of incompatibility. The spike converter is not production code. This resolves S4's owner disposition under Q0, not the S4 technical criterion.
4. ~~**S5:** D1, D2, the half-open hi-hat key and the [CONV] conventions~~ — decided 2026‑11‑25 (ADR-0002 Amendment 5): D1-a (MHD invariant 7 kept; implicit `repeatStart` in the Playback Score only, not yet verified against alphaTab), D2-a (skipped closing bar rejected, invariant 14), H-a (timeline reports the MHD GM key; 42 + halfOpen vs alphaTab's sounding 46 is a documented exception), [CONV] 1–3 adopted as MHD rules, [CONV] 4 replaced by at most one segno and one coda (invariant 15); default dynamic left open until MHD v1 finalisation in Phase 1. The remaining gap, parity under these rules, is placed in Phase 1 (§Phase 1). The S5 pass criterion is **not** met by these decisions.
5. **S7:** the uncovered sustain-pedal and hand-split questions.
6. ~~**Clean clone:** verify the literal `pnpm dev` and fix the README web-only step~~ — resolved 2026‑11‑25: README web step changed to `pnpm turbo run dev --filter=@musichub/web`; literal `pnpm dev` verified (recheck above).

With S6 decided, all three exit criteria above are met.

**Q0 — Phase 0 completion rule (owner decision 2026‑11‑25, Option C).** Phase 0 is complete when (a) the three exit criteria above are met **and** (b) the owner has recorded a disposition for each MUSIC_ENGINE.md §10 spike whose pass criterion is not met: S3, S4, S5 and S7 (items 2–5 above). A disposition is either an accepted alternative (for S3 only under the conditions of ADR-0002 A9) or an explicit placement of the gap as a constraint or deferred item in a named later phase. A disposition does not mean that the original criterion was met, and the §10 pass criteria are unchanged. Rejected readings: A (the three criteria alone, gaps carried over without a decision) and B (every §10 criterion must pass).

**Status (2026‑11‑25):** (a) is met; (b) is recorded for S5 (2026‑11‑25, item 4: semantics decided, parity verification placed in Phase 1) and S3 (2026‑11‑25, item 2: gap placed in Phase 3, Phase 1 architecture constraint; S3 technically not met) and S4 (2026‑11‑25, item 3: Phase 1 importer and MusicXML work, Phase 7 independent GP3–GP8 evidence; S4 technically not met) and pending for S7. Phase 0 is **not complete**, and Phase 1 code does not start before it is.

## Phase 1 — Music engine: viewer & player (≈ 4 weeks)

- `music-model`: MHD v1 final, `validateDocument`, IDs, tempo map, timeline (playback order + `NoteEvent` incl. hand), `DerivedMeta`, migrations framework, templates, JSON Schema export.
- `music-engine`: `fromAlphaTab` (import), `toAlphaTab` (render/playback/export variants), `PlaybackController`, audio-anchored `PlaybackClock`, exports (MHD, GP7, MIDI, alphaTex), theme mapping.
- S3 architecture constraint (owner decision 2026‑11‑25, ADR-0002 A16): Phase 1's `toAlphaTab`, render-controller and Playback Score architecture must not preclude a partial Render Score, off-main-thread conversion, or MIDI regeneration on play. They are options kept feasible for Phase 3, not Phase 1 deliverables or proven optimisations.
- S5 timeline semantics (owner decisions 2026‑11‑25, ADR-0002 Amendment 5): Phase 1 work: implement and verify the implicit Playback Score `repeatStart` for D1 (report a failure to the owner, no silent change of semantics); implement invariant 14 (D2) in `validateDocument` and adapt the S2-05 `repeats` fixture in a separately scoped task; keep and test the half-open hi-hat exception; implement and test [CONV] rules 1–3; implement and test invariant 15 (marker count); decide the default dynamic during MHD v1 finalisation.
- Web studio in **view mode**: open a local file (drag & drop), multi-track view, track visibility, layout mode, zoom, transport, A‑B loop (Selection API), speed, metronome, count-in, mixer.
- Coverage matrix (`music-engine/COVERAGE.md`); round-trip golden tests.
- S4 import work (owner decision 2026‑11‑25, ADR-0002 A17): production `fromAlphaTab` importer, `music-engine/COVERAGE.md` and golden round-trip tests on legally usable MusicXML fixtures; handling of the three recorded import deviations (D.S. al Coda → Dal Segno, U+00A0 in part names, `steal-time-previous` grace timing); MHD decisions on tenuto, slur and the transposing-staff key signature; investigation and handling of the GP7 stringed-staff finding. Independent GP3–GP8 evidence is Phase 7 work.
- Third-party notices page `/legal/notices` (alphaTab MPL‑2.0, Bravura OFL, SONiVOX Apache‑2.0) before any build is shown to users. A Playwright test asserts that the alphaTab attribution is visible and not clipped on a fixture with > 10 bars, in light and dark themes.
- Design tokens (including the design-token skeleton, moved from Sprint 2 by decision C1); Tailwind v4 + shadcn/ui setup in `packages/ui` with core primitives themed by tokens; Storybook.

**Exit:**
- Fixtures import, render and play correctly in Chrome, Firefox and Safari.
- GP7 and MIDI exports open in third-party apps.

*Open verification risk (recorded 2026‑11‑25, no decision taken):* the exit criterion above is unchanged and not verified; PROJECT_SPEC.md §2.1 states that the GP7 export opens in GP7/GP8 only, and under OQ2 no Guitar Pro is purchased, so how it will be verified is an **open verification risk**, not decided here.
- Timeline parity tests (S5) pass.

## Phase 2 — Piano Visualizer, MIDI input & Practice (≈ 5 weeks)

- `piano-visualizer`: studio bottom panel + full-screen mode; hand colors.
- `midi-engine`: Web MIDI input (device picker, hot-plug, sustain), live key highlight, monitoring sound (latency check of `playNote` vs own sampler).
- `practice-core` + `/practice/[id]` view: listen / play-along / wait modes, hand selection with hand-split playback score (S7), loop, speed, correctness check, per-loop stats.
- Practice results: `PracticeSession` summaries in a local IndexedDB outbox, already in the final sync format (API.md §7a), plus local progress display. No account needed yet.
- Optional spike S8, MIDI guitar (Q21): only if hardware is available. It does not block the phase exit. The result goes to the owner for a decision on v1 scope.
- Guitar practice: listen/play-along with time/BPM/attempt stats, without correctness checking.
- Calibration screen (audio offset).
- WAV export (`exportAudio` + WAV encoder).

**Exit:**
- 60 fps on the reference laptop with a dense piano fixture; offset < 20 ms after calibration; MIDI highlight < 30 ms.
- Wait mode and evaluation pass the table tests.
- One-hand practice plays only the other hand.

## Phase 2M — Mobile audio/MIDI prototype (≈ 2 weeks, right after Phase 2)

Decided by the owner on 2026‑11‑21: the mobile prototype runs right after Phase 2, not at the start of Phase 8, so mobile risks are known early.

- Real iOS and Android devices with USB and BLE MIDI keyboards. Questions M1–M7 (MOBILE.md §6).
- It uses what Phase 2 produced (`midi-engine` contracts, `practice-core`, the audio-anchored clock, `piano-visualizer` geometry) and a minimal `ScoreView` bundle.
- Code lives in `spikes/mobile-*`: a throw-away Expo app outside the pnpm workspace, consuming the shared packages via workspace links or a local build. It is not the production `apps/mobile`.
- Scheduling: with one developer it runs sequentially before Phase 3 (+2 weeks). With two developers it runs in parallel with the start of Phase 3.

**Exit:**
- ADR‑0005 updated with the chosen audio option (A1/A2/A3) and visualizer option (V1/V2), the native modules list, the library approvals requested (Q18) and a go/no-go per mobile v1 feature.
- Any finding that affects shared packages (e.g. clock or contract changes) is fed back into the web plan before Phase 3 work depends on it.

## Phase 3 — Editor: tablature & notation (≈ 6–8 weeks)

- `editor-core`: commands with inverses, undo/redo, selection, caret, keyboard map; Zustand vanilla studio store.
- Tab entry, notation entry, durations/tuplets/dots/ties/rests, voices (1–4), techniques and effects, sustain pedal.
- Bar and track operations: insert/delete bars, time/key signature, tempo (BPM) changes, repeats, sections, instruments, tunings, capo.
- Caret/selection overlay from `boundsLookup`; render scheduler with the fallback strategy chosen in S3; playback-stop/restore behaviour on edit.
- S3 edit-loop latency (deferred here by owner decision 2026‑11‑25, ADR-0002 A16): measure the real edit loop, with the real `editor-core` and RenderScheduler, under the unchanged ADR-0002 A9 method on the 300 × 8 reference document (`performanceDocument(300)`); evaluate a partial Render Score, off-main-thread conversion and MIDI regeneration on play, and/or an A9 fallback; report MIDI readiness and playback-position restoration separately. S3 closes only through an A9 pass or an A9-compliant fallback explicitly selected and accepted by the owner.
- Note audition (`playNote`), MIDI step entry.
- Local persistence: IndexedDB drafts (≤ 2 s), crash recovery, single-tab lock, "new composition" templates.

**Exit:**
- A user can create a 2-track (guitar + bass) song from scratch, play it and export GP7 without another tool.
- Undo/redo covers all commands.
- No data loss on reload or crash.

## Phase 4 — Accounts, library & cloud sync (≈ 4 weeks)

- Identity module (register/login/verify/reset), Sanctum SPA, profile and avatar (verified email required for uploads, API.md §1.1); auth/settings forms with React Hook Form + Zod.
- Library: compositions, folders, tags, search, trash (DATABASE.md, API.md §3–5).
- Document revisions (`If-Match`, revision kinds), server autosave cadence, conflict dialog, version history, named versions, thinning job.
- Client-side import flow with `POST /uploads` (originals retained); import warnings UI.
- Practice sync: Practice module, `/me/practice/*` endpoints, outbox flush, progress/goals/resume across devices, sync toggle, practice export/delete (ARCHITECTURE.md §6a).
- Object storage (managed S3 in prod; SeaweedFS locally), Horizon, rate limits, Sentry.
- **API contract validation (moved from Sprint 1):** add OpenAPI schema validation (`opis/json-schema` or an approved OpenAPI validator) and contract checks of API responses in Pest. Every Laravel response covered by `openapi.yaml` must be validated against the spec.
- **Compose `full` profile (moved from Sprint 1):** `api` (php-fpm 8.4 + Caddy) and `horizon` containers.

**Exit:**
- Editing in two browsers produces a conflict that can be resolved.
- Offline edits sync on reconnect.
- Contract tests validate all implemented endpoints against `openapi/openapi.yaml`.
- Policy tests for private data pass, including practice data never appearing in public/community responses.
- A practice session recorded offline on one browser appears on another after reconnect.
- Revision thinning is verified.

## Phase 5 — Piano Roll, recording & MIDI output (≈ 4 weeks)

- Piano Roll projection with quantised editing (MUSIC_ENGINE.md §8), sharing keyboard geometry with the visualizer.
- MIDI recording against the playback clock, with quantisation.
- MIDI device output scheduler in `midi-engine` (optional per track).

**Exit:**
- 8 bars recorded from a MIDI keyboard into a piano track can be edited in the piano roll and show correct notation.
- MIDI out drives an external synth with < 10 ms jitter.

## Phase 6 — Community (≈ 4 weeks)

- Publishing (visibility, license), public composition page (SSR, SEO, read-only player + visualizer + practice link).
- Profiles, user search, follows, likes, comments (one reply level), explore and following feed, tags, notifications.
- Moderation: reports, blocks, admin queue, takedown workflow; Terms of Service and privacy policy (legal review).
- Optional social sign-in (Q8). Access matrix enforcement for community actions (API.md §1.1, Q14) and anti-spam rules (new-account limits, link limits, duplicate detection, report auto-hide; API.md §10.1).

**Exit:**
- Public pages render server-side with < 1 s TTFB.
- The moderation flow is tested end to end.
- The ToS is live.

## Phase 7 — Hardening & Web v1.0 launch (≈ 3 weeks)

- Performance pass on large scores, accessibility audit (WCAG 2.2 AA chrome), UK i18n, security review, backup and restore drill, API load test.
- S4 Guitar Pro import evidence (owner decision 2026‑11‑25, ADR-0002 A17): independent GP3–GP8 import evidence from legally usable fixtures under OQ2/OQ3, before v1.0. Such fixtures are not guaranteed to exist; if none are available, the owner decides how Guitar Pro import is presented at launch. Missing GP evidence is not evidence of incompatibility.
- Node 26 patch update, dependency/license audit, notices page review.
- Personal data export (`POST /me/data-export`) and account deletion verified end to end.
- Onboarding, help and shortcut sheet, error-reporting UX.

**Exit:** v1.0 is released to production; runbooks exist in `docs/ops/`.

## Phase 8 — Mobile apps (≈ 6–8 weeks)

**8.0 Prototype re-check, ≈ 2–3 days.** The prototype ran in Phase 2M. Re-run M1–M3 and M5 on current Expo, React Native and alphaTab versions, because about 6 months will have passed. Update ADR‑0005 if results changed.

**8.1 Mobile v1 development:**
- `apps/music-worker` + server-side import endpoints (API.md §6) for the share sheet.
- Expo app: auth, library with offline cache, `ScoreView` (WebView, notation), playback per ADR‑0005, Piano Visualizer, MIDI via the native module, practice with synced progress (SQLite outbox), community.
- No port of the web editor (MOBILE.md §2).
- TestFlight / Play internal testing → store release.

**Exit:** apps are approved in both stores; crash-free sessions ≥ 99.5 % in beta; MIDI key → highlight < 30 ms on the reference devices.

## Phase 9 — Post-release (not scheduled)

### 9a. Learning system design (Q20)

A separate product and architecture design for MusicHub learning: course catalog, course/module/lesson hierarchy, curriculum builder, teacher roles, certificates and LMS-like features. It builds on the v1 practice data (`source`/`source_ref`, fragments, goals) without reworking it. It starts with its own specification and owner approval.

### 9b. Audio/AI phase (Q21)

Research and specification first, then implementation:
- Microphone pitch detection.
- Single note and chord recognition.
- Rhythm detection.
- Error detection.
- Comparison of the user's performance with the original part (MUSIC_ENGINE.md §11a).

AI features (separate spec) belong here too.

### 9c. Other deferred items

MIDI file import (Q4), MusicXML export (Q3), real-time collaboration, tablet editing on mobile, better SoundFonts (license review), printing/PDF.

## Dependencies between phases

```
P0 ─▶ P1 ─▶ P2 ─▶ P2M ─▶ P3 ─▶ P4 ─▶ P5 ─▶ P6 ─▶ P7 ─▶ P8 ─▶ P9
                    (P2M runs in parallel with P3 when two developers are available)
```

- P2 needs P1's clock and timeline. P3 needs P1's adapter and render controller, not P2.
- P2 and early P3 can overlap when two developers are available.
- P4 backend work (Identity, Library) can start in parallel with P3 once API.md §3–5 is frozen in `openapi.yaml`.
- P5 needs P2 (`midi-engine`) and P3 (`editor-core`).
- P2M needs P2. P8 needs P7 (web v1.0) and the P2M results (ADR‑0005).

---

## Sprint 1 — Foundation (2 weeks)

**Goal:** a clean, reproducible monorepo with an empty Next.js app, an empty Laravel API, local services, tests and CI. No music features, no UI components and no alphaTab (alphaTab arrives in Sprint 2, spike S1).

**Complexity:** S ≤ ½ day · M 1–2 days · L 3–5 days.

| ID | Title | Depends on | Complexity | Status (2026‑11‑22, `main` at `3e19d87`) |
|---|---|---|---|---|
| S1-01 | Monorepo initialisation | — | S | ✅ done |
| S1-02 | pnpm & Turborepo configuration | S1-01 | S | ✅ done: explicit workspace members without `apps/api`, pnpm catalog, turbo `codegen`/`test:e2e`/`inputs`/env; second run is a full cache hit |
| S1-03 | TypeScript & ESLint presets | S1-02 | M | ✅ done: tsconfig `react-library`/`nextjs`, ESLint 10 `react`/`next` layers, dependency-cruiser rules verified with probe violations (ADR‑0006 D1, D2) |
| S1-04 | Code formatting | S1-01 | S | ✅ done: Prettier, EditorConfig, Pint (`declare_strict_types`) |
| S1-05 | Next.js application skeleton | S1-03 | M | ✅ done: Next 16.4.6 Turbopack; SSR homepage shows `API: ok/unavailable` via the generated client |
| S1-06 | Laravel API skeleton | S1-01 | M | ✅ done: Laravel 13.43, PHP `^8.4` (locally `php84`, ADR‑0006 D3), API-only, `/api/v1/health`, problem details, Pest 5, Larastan level 8, Pint |
| S1-07 | Docker Compose services | — | M | ✅ done: PostgreSQL 18, Redis 8, Mailpit, SeaweedFS 4.54 (ADR‑0007) with idempotent bucket bootstrap `seaweedfs-init`. The `full` profile is deferred to Phase 4 |
| S1-08 | PostgreSQL & Redis integration | S1-06, S1-07 | M | ✅ done: pgsql, Redis cache/queue/session, `citext`/`pg_trgm`, health checks, S3 disk on SeaweedFS verified by a real Pest integration test (put/get/delete, presigned URL) |
| S1-09 | Test environments | S1-05, S1-08, S1-11 | M | ✅ done: Vitest (node/jsdom, v8), Pest on PostgreSQL `musichub_test`, Playwright with auto-started Next.js |
| S1-10 | GitHub Actions CI | S1-04, S1-09, S1-12 | M | ✅ done: first run on GitHub green (push to `main`, run 45060685119): `js` 37 s, `php` with PostgreSQL/Redis/SeaweedFS 51 s, `e2e` 45 s; total ≈ 1.5 min. PR trigger and red checks verified in S2-00 (see §S1-10 *Verification results*). ⚠️ **Open:** merge protection on `main` (no ruleset / required checks yet) |
| S1-11 | Base shared package (`music-model` skeleton) + boundary enforcement | S1-03 | S | ✅ done (only the `.` export; subpaths arrive with real content in Sprint 2) |
| S1-12 | OpenAPI contract & `api-client` codegen | S1-02, S1-06 | M | ✅ done: OpenAPI 3.1, openapi-typescript + openapi-fetch, deterministic codegen, drift check. **Note:** the Pest health test checks the response *shape* by hand; it is **not** OpenAPI/JSON Schema validation (that is a Phase 4 task) |
| S1-13 | Documentation structure & ADRs | — | M | ✅ done: README, ADR‑0000…0007, glossary, PR template, AGENTS.md |
| S1-14 | Node.js 26 LTS toolchain (Q12 resolved) | S1-01 | S | ✅ done |

**Summary:**
- Done: S1-01…S1-14.
- Deferred to Phase 4: the Compose `full` profile (API + Horizon containers) and OpenAPI schema validation of API responses.

**Remaining to close Sprint 1:**
1. ~~Add the SeaweedFS service, bucket bootstrap and Pest S3 integration test~~ (done).
2. ~~Push the branch and get a green CI run on GitHub~~ (done: merged to `main`, run 45060685119 green).

Sprint 1 is closed pending owner review.

**Non-blocking technical debt:**
- The health contract test is a hand-written shape check, not OpenAPI validation (→ Phase 4).
- ESLint peer exceptions for `eslint-plugin-react` / `eslint-plugin-jsx-a11y`, plus an explicit React version setting (ADR‑0006 D1). Re-check when the plugins support ESLint 10.
- The `openapi-typescript` peer exception for TypeScript 6 (ADR‑0006 D2).
- The standard Laravel queue migration is kept: `jobs` is unused with Redis, `failed_jobs` is used (DATABASE.md §3.14).
- PHP 8.4 must be invoked as `php84` on Herd machines (ADR‑0006 D3).
- Intermittent CI failure: the `php` job failed at "Start SeaweedFS and create the bucket" in runs [45061294454](https://github.com/volodymyraupqode-debug/musichub/actions/runs/45061294454) and [45066980858](https://github.com/volodymyraupqode-debug/musichub/actions/runs/45066980858). The cause is not established; the job logs need to be analysed and the fix is a separate task.
- Merge protection on `main` is not configured (see S1-10 *Verification results*); owner action in the GitHub repository settings.

### S1-01 Monorepo initialisation
- **Description:** root `package.json` (private, ESM, `packageManager: pnpm@12.21.0`, engines), `.nvmrc`, `engineStrict: true` in `pnpm-workspace.yaml` (pnpm 12 ignores `engine-strict` in `.npmrc` for the root project), `.editorconfig`, `.gitignore`, directory conventions (`apps/`, `packages/`).
- **Acceptance:** a clean clone + `nvm use` + `corepack enable` + `pnpm install` succeeds; wrong Node or pnpm versions fail fast.
- **Tests:** `pnpm install --frozen-lockfile` in CI.

### S1-02 pnpm & Turborepo configuration
- **Description:** `pnpm-workspace.yaml` lists `apps/web`, `apps/mobile`, `apps/music-worker`, `packages/*` (or `apps/*` + `!apps/api`). `turbo.json` tasks: `build`, `dev`, `lint`, `typecheck`, `test`, `test:e2e`, `codegen` with correct `dependsOn`/`outputs`/`inputs`. Remote cache disabled for now.
- **Acceptance:** `pnpm turbo run lint typecheck test` runs across all JS packages; a second run is a full cache hit; `apps/api` is not a workspace member (`pnpm ls -r` does not list it).
- **Tests:** CI runs turbo twice locally to verify caching (manual check); `pnpm ls -r --depth -1`.

### S1-03 TypeScript & ESLint presets
- **Description:** `packages/config` presets: `tsconfig/base.json`, `library.json` (exist), `react-library.json`, `nextjs.json`. ESLint layers: `base` (exists, incl. the alphaTab ban), `react` (react, react-hooks, jsx-a11y), `next` (`@next/eslint-plugin-next`). Add a dependency-cruiser config implementing ARCHITECTURE.md §3.1.
- **Acceptance:** each preset is used by at least one package in this sprint; ESLint rejects alphaTab imports outside `music-engine` and `any`; dependency-cruiser fails on a forbidden import (verified with a temporary probe file, then removed).
- **Tests:** `pnpm lint`, `pnpm typecheck`, `pnpm depcruise`.

### S1-04 Code formatting
- **Description:** Prettier config (exists; Markdown specs excluded on purpose), `format`/`format:check` scripts; Laravel Pint config (`pint.json`, Laravel preset) in `apps/api`.
- **Acceptance:** `pnpm format:check` and `composer format:check` (Pint `--test`) pass; CI fails on unformatted code.
- **Tests:** CI format steps.

### S1-05 Next.js application skeleton
- **Description:** `apps/web` with Next.js 16.4, App Router, Turbopack, React 19, TS via the `nextjs` preset, ESLint `next` layer. One server-rendered page that shows the API health status (`GET /api/v1/health`), with no design system. Environment config (`NEXT_PUBLIC_API_URL`), `.env.example`. No alphaTab, no studio.
- **Acceptance:** `pnpm --filter web dev` serves `/`; `pnpm --filter web build` succeeds; the page shows "API: ok/unavailable" without crashing when the API is down.
- **Tests:** typecheck, lint, Playwright smoke (S1-09).

### S1-06 Laravel API skeleton
- **Description:** `apps/api` as a standalone Composer project: Laravel 13, PHP 8.4, API-only (remove Vite/Tailwind/`package.json`/`resources/js|css`), routes under `/api/v1`, `GET /api/v1/health` (DB + Redis checks) per API.md §2a, problem-details exception rendering (API.md §1), Pest, Larastan (level ≥ 8), Pint, Composer scripts `lint`, `test`, `format:check`. Sanctum is **not** installed yet (Phase 4).
- **Acceptance:** `composer install && php artisan serve` (or Herd) serves `/api/v1/health`; JSON follows API.md; `composer lint` and `composer test` pass; no `node_modules` in `apps/api`.
- **Tests:** Pest feature tests for health `200` and `503` (Redis/DB unavailable simulated), and for the problem-details 404 format.

### S1-07 Docker Compose services
- **Description:** `infra/docker-compose.yml`: `postgres:18`, `redis:7.4` or `8` (Q13), `seaweedfs` (single node, S3 on 8333, ADR‑0007; replaces MinIO) + bucket bootstrap (`musichub-local`), `mailpit`. Healthchecks, named volumes, ports from `.env`. The optional profile `full` with `api` (php-fpm 8.4 + Caddy) and `horizon` is **deferred to Phase 4** and does not block Sprint 1. `infra/README.md` with start/stop/reset.
- **Acceptance:** `docker compose -f infra/docker-compose.yml up -d` gives healthy services; data persists across restarts; `down -v` resets.
- **Tests:** CI job (or manual) runs `docker compose config` validation; healthcheck status checked by a script.

### S1-08 PostgreSQL & Redis integration
- **Description:** Laravel `.env.example` for `pgsql`, Redis cache/queue/session drivers, S3 disk pointing to SeaweedFS (`AWS_ENDPOINT=http://127.0.0.1:8333`, path-style). First migration enables `citext` and `pg_trgm` (DATABASE.md §1.1). A separate test database `musichub_test`.
- **Acceptance:** `php artisan migrate` on a fresh compose stack succeeds; health reports both checks `ok`; `php artisan queue:work` connects to Redis; a test file can be put to and read from the S3 disk.
- **Tests:** Pest: migration test asserting the extensions exist; health integration test against real services.

### S1-09 Test environments
- **Description:** Vitest preset in `packages/config` (node + jsdom variants, coverage via v8) used by `music-model`; Pest uses PostgreSQL (not SQLite) with `RefreshDatabase`; Playwright in `apps/web` with one smoke test, starting the Next.js server automatically.
- **Acceptance:** `pnpm test` runs Vitest in every package that has tests; `composer test` runs Pest against `musichub_test`; `pnpm --filter web test:e2e` passes headless in Chromium.
- **Tests:** the suites themselves; a deliberately failing assertion makes the command exit non-zero (checked once).

### S1-10 GitHub Actions CI
- **Description:** `.github/workflows/ci.yml` on PR and `main`, with concurrency cancel.
  - Job `js`: Node from `.nvmrc`, corepack, pnpm cache, `pnpm install --frozen-lockfile`, `format:check`, `turbo run lint typecheck test build`, depcruise, codegen drift check (`git diff --exit-code`).
  - Job `php`: `shivammathur/setup-php` 8.4, Composer cache, Pint `--test`, Larastan, Pest with `postgres:18` and `redis` services, plus SeaweedFS started from `infra/docker-compose.yml` for the S3 integration test.
  - Job `e2e`: Playwright smoke (Chromium) after `js`.
- **Acceptance:** all jobs are green on a PR. A lint error, a failing test and a codegen drift each make CI red (verified on a throw-away branch). Runtime < 10 min.
- **Tests:** the workflow itself; `actionlint` locally (optional).
- **Verification results (S2-00, 2026‑11‑22).** All runs below were triggered by `pull_request` on the throw-away branches `ci/verify-red-checks` (PR #1) and `ci/verify-red-checks-2` (PR #2).

  | Scenario | Commit | Run | JS | PHP | E2E |
  |---|---|---|---|---|---|
  | Neutral PR | `08b6b32` | [45064056816](https://github.com/volodymyraupqode-debug/musichub/actions/runs/45064056816) | success | success | success |
  | A. Lint failure | `70068df` | [45065440359](https://github.com/volodymyraupqode-debug/musichub/actions/runs/45065440359) | failure (`@typescript-eslint/no-explicit-any`) | success | skipped |
  | Revert A | `b643a0b` | [45065762506](https://github.com/volodymyraupqode-debug/musichub/actions/runs/45065762506) | success | success | success |
  | B. Test failure | `8b3b9bc` | [45066120753](https://github.com/volodymyraupqode-debug/musichub/actions/runs/45066120753) | failure (Vitest assertion) | success | skipped |
  | Revert B | `75ce9b4` | [45066667253](https://github.com/volodymyraupqode-debug/musichub/actions/runs/45066667253) | success | success | success |
  | C. Codegen drift | `6131bd0` | [45066980858](https://github.com/volodymyraupqode-debug/musichub/actions/runs/45066980858) | failure (codegen drift check) | failure (SeaweedFS start; unrelated to the OpenAPI change, see technical debt) | skipped |
  | Revert C | `1fa26ce` | [45067148932](https://github.com/volodymyraupqode-debug/musichub/actions/runs/45067148932) | success | success | success |

  - **Confirmed:** CI runs on pull requests; a lint error, a failing test and a codegen drift each turn the `js` job red at the expected step; a red `js` is not masked by a green `php`; `e2e` is skipped when `js` fails (`needs: js`). Runtime ≈ 1.5 min.
  - **Not confirmed — merge protection.** At verification time `main` had no ruleset or branch protection with required checks. PR #1 was merged before its CI run finished, and PR #2 was merged after the run on its last commit was green (PR #1 added only a README comment, removed again by the S2-00 results change; PR #2 contained only probe/revert pairs and left the `main` tree unchanged). CI therefore detects errors but does **not block merging** until the owner configures a GitHub ruleset for `main` (pull request required; required checks JS, PHP and E2E, all three, because a skipped `e2e` counts as passing).

### S1-11 Base shared package (`music-model` skeleton) + boundary enforcement
- **Description:** `packages/music-model` with the `library` tsconfig, ESLint base, Vitest, `build` (tsc), subpath export layout (`.`, `./schema`, `./timeline`, `./contracts`) and only the public constant `MHD_FORMAT = 'musichub'` / `MHD_SCHEMA_VERSION = 1`. The real schema comes in Sprint 2. `apps/web` imports it once to prove the wiring. dependency-cruiser rules are active in CI.
- **Acceptance:** `pnpm --filter music-model build test` passes; web build consumes it; depcruise forbids `music-model → react|@coderline/alphatab|dom`.
- **Tests:** one unit test of the exported constants; depcruise probe.

### S1-12 OpenAPI contract & `api-client` codegen
- **Description:** `openapi/openapi.yaml` (3.1) with `info`, servers, the problem-details schema and `GET /health`. `packages/api-client` generated with `openapi-typescript` + a thin `openapi-fetch` wrapper. Turbo `codegen` task; generated output is committed. A Pest test checks the health response shape by hand (OpenAPI schema validation follows in Phase 4).
- **Acceptance:** changing the spec and running `pnpm codegen` updates types; the web health page uses the generated client; CI fails on drift; the Pest health test fails if the health JSON shape deviates (a hand-written shape check, not OpenAPI validation; full validation is a Phase 4 task).
- **Tests:** `pnpm codegen && git diff --exit-code`; Pest health shape test.

### S1-13 Documentation structure & ADRs
- **Description:**
  - `docs/adr/0000-template.md`.
  - ADR‑0001…0003 accepted (monolith + Composer API, MHD, snapshot sync); ADR‑0005 accepted (Expo native-first; WebView only for notation; audio/visualizer placement left open for the Phase 2M prototype); ADR‑0004 proposed until spike S1. ADR‑0006 records the approved library list (PROJECT_SPEC §5.1–5.2).
  - Root `README.md` titled **MusicHub**, with the product description (PROJECT_SPEC.md §1), quick start and a link to AGENTS.md.
  - `docs/glossary.md` (EN/UK music terms).
  - `.github/pull_request_template.md` (AGENT_RULES §10 checklist).
  - The AGENTS.md commands section updated with real commands.
- **Acceptance:** every ADR follows the template and links the spec sections; AGENTS.md commands work as written.
- **Tests:** markdown link check (e.g. `lychee` in CI, optional).

### S1-14 Node.js 26 LTS toolchain
- **Description:** Node 26.13.1 in `.nvmrc`; `engines.node` `>=26.13.0 <27`; pnpm 12.21.0 via `packageManager`; CI uses `actions/setup-node` with `node-version-file: .nvmrc` plus `pnpm/action-setup` (reads `packageManager`) (S1-10); `@types/node@26` where Node types are needed. Never use Current/odd Node releases. Node 25+ no longer bundles Corepack, so install it with `npm i -g corepack` before `corepack enable`.
- **Acceptance:** `pnpm install` fails on Node ≠ 26 (`ERR_PNPM_UNSUPPORTED_ENGINE`, verified on 22.23.2); all Sprint 1 checks pass on Node 26; a dependency whose `engines` excludes Node 26 is rejected.
- **Tests:** `node -v` in CI logs; full CI.

**Sprint 1 Definition of Done:**
- A clean clone, a short README section and three commands give a running web page showing `API: ok` backed by PostgreSQL + Redis in Docker.
- CI enforces lint, format, types, tests, boundaries and codegen drift.
- No music code exists yet.

## Sprint 2 — Spikes & model draft

**Goal:** answer the Phase 0 spike questions (MUSIC_ENGINE.md §10, S1–S7), draft MHD v1 in `music-model` with hand-written fixtures, collect legally usable import fixtures, and record the results in ADR‑0002 and ADR‑0004 (Phase 0 scope above). Design tokens are not part of Sprint 2 (Phase 1, decision C1).

**Status (2026‑11‑25):** in progress. Done: S2-00…S2-07. Done through fallback selection: S2-08 (S6, owner decision 2026‑11‑25). Partly done: S2-09 (MusicXML part), S2-10 (measured; target not met for large scores). Done: S2-12 (PR #19). TBD: S2-11, S2-13. Spike ids S3–S7 (MUSIC_ENGINE.md §10) are kept in the technical docs; task ids and spike ids differ (S2-06 = S5, S2-07 = S7, S2-08 = S6, S2-09 = S4, S2-10 = S3).

Done research spikes do not by themselves meet the Phase 0 exit criteria (§Phase 0 *Exit*). Phase 0 is not complete: the three exit criteria are met (S6 through the accepted fallback, 2026‑11‑25; spike results recorded by S2-12), but under the Q0 rule (§Phase 0, owner decision 2026‑11‑25) the owner's dispositions for the unmet §10 spikes are still open for S7 (sustain pedal, hand split). S4's disposition is recorded (2026‑11‑25, ADR-0002 Amendment 7): S2-09 stays partly done (14 of 20 files, MusicXML only, no GP3–GP8); the importer and MusicXML work move to Phase 1, independent GP3–GP8 evidence to Phase 7. S5's disposition is recorded (2026‑11‑25, ADR-0002 Amendment 5); its parity criterion moves with the Phase 1 work. S3's disposition is recorded (2026‑11‑25, ADR-0002 Amendment 6): S2-10 stays partly done (< 150 ms not met on large scores, no fallback selected) and the gap moves to Phase 3.

| ID | Title | Depends on | Status | Result / scope |
|---|---|---|---|---|
| S2-00 | CI pull-request verification | Sprint 1 | ✅ done (PR #1, #2, #3) | PR trigger confirmed; JS, PHP and E2E green on a neutral PR; a lint error, a failing test and a codegen drift each turn `js` red (runs in §S1-10 *Verification results*). Open: merge protection on `main` (ruleset not enforced) and intermittent SeaweedFS start failures (technical debt, §Sprint 1) |
| S2-01 | Spike workspace infrastructure | S2-00 | ✅ done (PR #4) | `spikes/*` workspace glob and `spikes/README.md`; catalog entries `@coderline/alphatab` 1.9.0 and `zod` 4.6.7; ESLint preset `@musichub/config/eslint/spike` (alphaTab allowed only in `spikes/`); dependency-cruiser rules for spikes and the `exclude` fix that restored checks on `node_modules` targets; import boundaries verified with probes |
| S2-02 | MHD v1 schema and validation | S2-01 | ✅ done (PR #5) | Strict Zod schemas and types in `packages/music-model`; UUIDv7 document id and 12-character base62 element ids; `validateDocument` with the cross-field invariants of MUSIC_ENGINE.md §3.3; JSON Schema `json-schema/mhd-v1.schema.json`; `fixtures/v1/` reserved and documented; versioning rule (every structural change bumps `schemaVersion` after the first public release or saved document). Follow-up D1: `drumTechnique` replaces `drumArticulation` |
| S2-03 | Hand-written MHD v1 fixtures | S2-02 | ✅ done | `packages/music-model/fixtures/v1/`: `guitar-basic`, `piano-grand-staff`, `band-repeats` (`.mhd.json`), original synthetic content, each valid with zero issues. Sidecars `<name>.expected.json` hold the validation result and structural counts only (D4); `src/fixtures.test.ts` imports both as JSON modules (D3) and runs negative mutations. Conventions O1–O5 in `fixtures/v1/README.md` |
| S2-04 | Spike S1: alphaTab 1.9.0 in Next.js 16 + Turbopack | S2-01 | ✅ done | `spikes/s1-turbopack`; report `docs/spikes/s1-turbopack.md`. Turbopack setup works without the webpack plugin: Turbopack-bundled workers, audio worklet from `core.scriptFile`, playback cycle, `display.resources` themes. Chromium (dev + prod) and Playwright Chromium/WebKit checked automatically; Safari and Firefox passed manual checks by the owner, including audible playback. ADR-0004 accepted with documented limitations. Spike kept until the end of Sprint 2. Import fixtures for S4 are a separate task after OQ2 |
| S2-05 | Spike S2: MHD → alphaTab, Strategy A vs B | S2-03, S2-04 | ✅ done (PR #10, #11, #12, #13) | `spikes/s2-mhd-to-alphatab`; report `docs/spikes/s2-mhd-to-alphatab.md`. Both strategies convert all 3 canonical, 10 synthetic and a 300 × 8 document with identical facts, MIDI notes and layout; shared alphaTab losses documented. Recommendation: A (direct model + `finish()`) with B (alphaTex) as test oracle; median 55–63 ms vs 105–121 ms for 300 × 8. Owner decisions Q-A…Q-E taken; ADR-0002 Amendment 1 records Strategy A, the diagnostics contract and separate Render and Playback Scores (PR #12, #13). Follow-up (Q-D/Q-E): `Bar.ottava` defined as a display-only bar octave line, positioned `MasterBar.fermatas` replace `fermata: true` (MHD v1, no version bump) |
| S2-06 | Spike S5: timeline parity | S2-05 | ✅ done (PR #14) | `spikes/s2-mhd-to-alphatab/src/timeline`; report `docs/spikes/s5-timeline-parity.md`. Independent MHD playback-order and MIDI-event prototype compared with alphaTab 1.9.0 `MidiFileGenerator` on the Playback Score: 17 of 19 golden scenarios at 100 % note-on, note-off and tempo parity. Open decisions for the owner at the time: D1 (repeat end after an earlier repeat), D2 (skipped closing bar), half-open hi-hat key (MHD 42, alphaTab 46), the [CONV] conventions. **Decided 2026‑11‑25** (ADR-0002 Amendment 5): D1-a, D2-a, H-a, [CONV] 1–3 adopted, at most one segno and one coda; default dynamic open (Phase 1). The pass criterion (100 % note-on parity) is not met until the Phase 1 parity tests pass under these rules |
| S2-07 | Spike S7: playback-score variants | S2-05 | ✅ done (PR #15) | `spikes/s2-mhd-to-alphatab` (`src/playback-variants`, `e2e`); report `docs/spikes/s7-playback-score-variants.md`. alphaTab 1.9.0 has no native API to play a Score other than the rendered one; a hook on the public `midiLoad` event that rewrites the MIDI with the Playback Score passed all automated criteria in Node (time axis, content, cursor beats, offline mute/solo) and with the real `AlphaTabApi` in Playwright Chromium and WebKit. Owner decision: keep the Render/Playback separation and the hook, with the constraints in ADR-0002 Amendment 2 (A7–A8); the fallback is not implemented. Manual browser verification by the owner passed, no issues observed (report §8). Sustain pedal and hand split not covered |
| S2-08 | Spike S6: audio clock accuracy | S2-04 | ✅ done through fallback selection (owner decision 2026‑11‑25; the 10 ms target is not met; PR #16, offline replay `9b21fe8`) | `spikes/s6-audio-clock`; report `docs/spikes/s6-audio-clock-accuracy.md`; raw data `spikes/s6-audio-clock/data/raw`. **Done:** 18 automated runs measuring alphaTab `playerPositionChanged` against the browser's audio-frame clock (Playwright Chromium and WebKit, headless): p95 anchor jitter < 10 ms in Chromium 9/9 runs (0.24–0.76 ms at 10 ms); in WebKit above 10 ms at the default 10 ms in 3 of 4 speed-1.0 runs (up to 14.37 ms) and below 10 ms at 0 ms (5.79–8.87 ms). `currentTime` excludes `playbackSpeed`; the score position comes from `currentTick` (MUSIC_ENGINE.md §5.1 note). ADR-0004 addendum *Deferred*. **Not verified:** real audio output latency and jitter (no loopback), Safari on a real device, Firefox. These measurements are not part of the current scope (owner decision 2026‑11‑24). **Fallback accepted 2026‑11‑25** (ADR-0004 Addendum 2, MUSIC_ENGINE.md §5.1): audio-anchored interpolated clock, score time `currentTime × playbackSpeed` with `currentTick` tracked separately, slew below 30 ms at 10 %, snap at 30 ms or more, interval 0 for WebKit/Safari and 10 elsewhere, no extrapolation before the first main-playback anchor; evidence `spikes/s6-audio-clock/REPLAY.md`; limitations as in ADR-0004 Addendum 2; to be implemented and verified in Phase 1 |
| S2-09 | Spike S4: import fidelity | S2-05, import fixtures | 🟡 partly done (MusicXML part; criterion not met; PR #17) | `spikes/s2-mhd-to-alphatab` (`src/import`, `fixtures/import`); report `docs/spikes/s4-import-fidelity.md`. Criterion unchanged (MUSIC_ENGINE.md §10: 20 public-domain/own GP3–8 and MusicXML files → MHD → GP7, coverage matrix) and **not met**. **Done:** 14 original hand-authored MusicXML fixtures (13 distinct contents + 1 compressed `.mxl`; synthetic own work, SHA-256 in `SOURCES.md`); spike alphaTab → MHD converter with explicit losses; coverage matrix for import (verified against independent intent), MHD and GP7 round trip (alphaTab on both sides). Deviations: D.S. al Coda → Dal Segno, no-break spaces in part names, grace timing from `steal-time-previous`; tenuto and slur not in MHD v1; GP7 round trip turns non-guitar staves stringed. **Not evaluated:** GP3, GP4, GP5, GP6/GPX, GP7, GP8 — no independent legally usable fixtures (a test-data gap, not evidence of incompatibility); an open gap that can be closed later if legal files appear. **Owner disposition 2026‑11‑25** (ADR-0002 A17, Option 2): Phase 1 owns the production importer, coverage matrix, MusicXML golden round-trip tests and the recorded findings; Phase 7 owns independent GP3–GP8 evidence before v1.0. Status unchanged: criterion not met |
| S2-10 | Spike S3: edit-loop latency | S2-05 | 🟡 partly done (measured; target not met for large scores, no fallback selected; PR #18) | `spikes/s2-mhd-to-alphatab` (`src/edit-loop`, `e2e/edit-loop*`); report `docs/spikes/s3-edit-loop-latency.md`; raw data `data/edit-loop`; ADR-0002 Amendment 3 (numbers and criterion A9). Edit command → next frame, Playwright Chromium / WebKit (median / p95): 8 × 4 16 / 22 and 27 / 79 ms (< 150 ms met); 50 × 8 84–98 / 147–185 and 114–169 / 245–558 ms (borderline / missed); 300 × 8 535 / 726 and 619 / 1312 ms (missed). No §6 fallback and no measured combination (best: render window + no MIDI, 244 / 352 ms) reaches < 150 ms on 300 × 8; none selected. Position restore after an edit during playback works (within 1 tick). **Acceptance criterion** (owner decision 2026‑11‑24, ADR-0002 A9): edit command received → first painted frame with the edited notation visible, p95 < 150 ms over ≥ 100 single edits in ≥ 2 sessions per reference environment, on `performanceDocument(300)`; MIDI readiness and position restore reported separately. **Status under A9: target not met, no fallback selected**; the historical runs above are lower bounds (no scheduler, no painted-frame confirmation) and cannot establish a pass. **Open at the time:** unmeasured options for large scores (partial Render Score, off-main-thread conversion, MIDI only on play) and new A9-conformant measurements for any future pass claim. **Owner disposition 2026‑11‑25** (ADR-0002 A16, Option B + D): the gap is placed in Phase 3 (real `editor-core` + RenderScheduler, unchanged A9, 300 × 8); Phase 1 must keep those three options feasible. Status unchanged: target not met |
| S2-11 | TBD | — | ❔ TBD | Not defined yet |
| S2-12 | Phase 0 evidence consolidation and exit-criteria audit | S2-04…S2-10 | ✅ done (PR #19) | Findings-only: ADR-0002 Amendment 4 records the S2, S4 and S5 results and indexes every Phase 0 spike result; MUSIC_ENGINE.md §10 results table; Phase 0 exit checklist (§Phase 0 *Exit status*); clean-clone check; AGENTS.md status. No decision, criterion or spike status changed |
| S2-13 | TBD | — | ❔ TBD | Not defined yet |

A numbering for S2-03…S2-13 was proposed in the Sprint 2 planning audit (2026‑11‑22). S2-00…S2-10 are confirmed by the owner (S2-07…S2-10 on 2026‑11‑24); S2-11…S2-13 get a scope when the owner approves them.

**Decisions taken for S2-03:** D3 native JSON module imports (`with { type: 'json' }`, no `@types/node`); D4 sidecars with validation result and structural counts only (playback order follows with the Phase 1 timeline).

**Decisions taken for S2-09 (spike S4, import fixtures), 2026‑11‑24:** OQ2 and OQ3 were raised in the Sprint 2 planning audit (2026‑11‑22) and are recorded here so they no longer exist only in conversation history.
- **OQ2** — *question:* should Guitar Pro 8 be bought for GP7/GP8 fixtures, and where can legally usable GP6 `.gpx` files come from? *Decision (owner): options B + D.* No Guitar Pro purchase and no paid software. GP3–GP5 may come from TuxGuitar exports, but only for formats and versions TuxGuitar is verified to *export* (opening a format is no proof). MusicXML comes from original, hand-authored fixtures (own work, labelled synthetic) and from public-domain sources such as OpenScore, each file's provenance and licence verified individually. GP6–GP8 stay **not evaluated** unless independent, legally usable files are found; alphaTab's own `Gp7Exporter` output is never independent GP7 reference data. S2-09 does not claim GP3–GP8 coverage.
- **OQ3** — *question:* may files from alphaTab's test-data repository be used? *Decision (owner): no*, unless the provenance and licence of each file are independently verified and the owner approves it; for S2-09 they are not approved.
- External tools and downloads (TuxGuitar, MuseScore, public-domain files) need the owner's approval before installation or download.

**Open decisions:**
- Document id ownership (client UUIDv7 as composition id) and a UUIDv7 generator: before Phase 1, not blocking S2-03.

**Open infrastructure items:** enforce the GitHub ruleset for `main` (owner action); root cause of the SeaweedFS start failures in the `php` job.
