# MusicHub — Roadmap

> Status: Draft v0.2 (audited 2026‑11‑21) — awaiting approval. The order follows the required strategy: **web first → music engine before advanced editing → editor before community → mobile after web → AI after initial release.** Durations are rough estimates for a small team (1–2 developers + AI agents). They will be re-estimated after Phase 0. Sprints are 2 weeks.
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

**Sprint 2, spikes and model draft:**
- Spikes S1–S7 (MUSIC_ENGINE.md §10) in `spikes/`; results recorded in ADR‑0002 and ADR‑0004.
- MHD v1 schema draft in `music-model` (types + Zod + invariants), 3 hand-written fixtures (guitar, piano grand staff with pedal, band with repeats/endings).
- Legally usable import fixtures (own or public-domain GP3–8 and MusicXML files).

**Exit:**
- `pnpm install && pnpm dev` and `docker compose up` work from a clean clone; CI is green.
- Spike numbers are recorded and the `toAlphaTab` strategy is decided.
- S6 clock jitter < 10 ms, or a fallback is chosen.

## Phase 1 — Music engine: viewer & player (≈ 4 weeks)

- `music-model`: MHD v1 final, `validateDocument`, IDs, tempo map, timeline (playback order + `NoteEvent` incl. hand), `DerivedMeta`, migrations framework, templates, JSON Schema export.
- `music-engine`: `fromAlphaTab` (import), `toAlphaTab` (render/playback/export variants), `PlaybackController`, audio-anchored `PlaybackClock`, exports (MHD, GP7, MIDI, alphaTex), theme mapping.
- Web studio in **view mode**: open a local file (drag & drop), multi-track view, track visibility, layout mode, zoom, transport, A‑B loop (Selection API), speed, metronome, count-in, mixer.
- Coverage matrix (`music-engine/COVERAGE.md`); round-trip golden tests.
- Third-party notices page `/legal/notices` (alphaTab MPL‑2.0, Bravura OFL, SONiVOX Apache‑2.0) before any build is shown to users. A Playwright test asserts that the alphaTab attribution is visible and not clipped on a fixture with > 10 bars, in light and dark themes.
- Design tokens; Tailwind v4 + shadcn/ui setup in `packages/ui` with core primitives themed by tokens; Storybook.

**Exit:**
- Fixtures import, render and play correctly in Chrome, Firefox and Safari.
- GP7 and MIDI exports open in third-party apps.
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
- Object storage, Horizon, rate limits, Sentry.

**Exit:**
- Editing in two browsers produces a conflict that can be resolved.
- Offline edits sync on reconnect.
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

| ID | Title | Depends on | Complexity | Status (2026‑11‑21, branch `chore/sprint-1-foundation`, uncommitted) |
|---|---|---|---|---|
| S1-01 | Monorepo initialisation | — | S | ✅ done |
| S1-02 | pnpm & Turborepo configuration | S1-01 | S | ✅ done: explicit workspace globs without `apps/api`, pnpm catalog, turbo `codegen`/`test:e2e`/`inputs`/env; second run is a full cache hit |
| S1-03 | TypeScript & ESLint presets | S1-02 | M | ✅ done: tsconfig `react-library`/`nextjs`, ESLint `react`/`next` layers, dependency-cruiser rules verified with probe violations. ESLint stays on 10 (ESLint 9 is EOL, see ADR‑0006) |
| S1-04 | Code formatting | S1-01 | S | ✅ done: Prettier, EditorConfig, Pint (`declare_strict_types`) |
| S1-05 | Next.js application skeleton | S1-03 | M | ✅ done: Next 16.4.6 Turbopack; SSR homepage shows `API: ok/unavailable` via the generated client |
| S1-06 | Laravel API skeleton | S1-01 | M | ✅ done: Laravel 13.43, API-only, `/api/v1/health`, problem details, Pest 5, Larastan level 8, Pint |
| S1-07 | Docker Compose services | — | M | 🟡 PostgreSQL 18, Redis 8, Mailpit done. **S3 storage blocked:** MinIO no longer publishes images (Q22) |
| S1-08 | PostgreSQL & Redis integration | S1-06, S1-07 | M | 🟡 pgsql, Redis cache/queue/session, `citext`/`pg_trgm`, health checks done. S3 disk is configured but untested until Q22 |
| S1-09 | Test environments | S1-05, S1-08, S1-11 | M | ✅ done: Vitest (node/jsdom, v8), Pest on PostgreSQL `musichub_test`, Playwright with auto-started Next.js |
| S1-10 | GitHub Actions CI | S1-04, S1-09, S1-12 | M | 🟡 workflow written and passes `actionlint`; not yet run on GitHub (needs a push) |
| S1-11 | Base shared package (`music-model` skeleton) + boundary enforcement | S1-03 | S | ✅ done (only the `.` export; subpaths arrive with real content in Sprint 2) |
| S1-12 | OpenAPI contract & `api-client` codegen | S1-02, S1-06 | M | ✅ done: OpenAPI 3.1, openapi-typescript + openapi-fetch, drift check. The Pest contract test asserts the schema shape by hand (no YAML/JSON-Schema validator yet; opis/json-schema is planned from Phase 4) |
| S1-13 | Documentation structure & ADRs | — | M | ✅ done: README, ADR‑0000…0006, glossary, PR template, AGENTS.md |
| S1-14 | Node.js 26 LTS toolchain (Q12 resolved) | S1-01 | S | ✅ done |

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
- **Description:** `infra/docker-compose.yml`: `postgres:18`, `redis:7.4` or `8` (Q13), `minio` + bucket bootstrap (`musichub-local`), `mailpit`. Healthchecks, named volumes, ports from `.env`. Optional profile `full` with `api` (php-fpm 8.4 + Caddy Dockerfile in `infra/`) and `horizon` placeholder (enabled in Phase 4). `infra/README.md` with start/stop/reset.
- **Acceptance:** `docker compose -f infra/docker-compose.yml up -d` gives healthy services; data persists across restarts; `down -v` resets.
- **Tests:** CI job (or manual) runs `docker compose config` validation; healthcheck status checked by a script.

### S1-08 PostgreSQL & Redis integration
- **Description:** Laravel `.env.example` for `pgsql`, Redis cache/queue/session drivers, S3 disk pointing to MinIO. First migration enables `citext` and `pg_trgm` (DATABASE.md §1.1). A separate test database `musichub_test`.
- **Acceptance:** `php artisan migrate` on a fresh compose stack succeeds; health reports both checks `ok`; `php artisan queue:work` connects to Redis; a test file can be put to and read from the S3 disk.
- **Tests:** Pest: migration test asserting the extensions exist; health integration test against real services.

### S1-09 Test environments
- **Description:** Vitest preset in `packages/config` (node + jsdom variants, coverage via v8) used by `music-model`; Pest uses PostgreSQL (not SQLite) with `RefreshDatabase`; Playwright in `apps/web` with one smoke test, starting the Next.js server automatically.
- **Acceptance:** `pnpm test` runs Vitest in every package that has tests; `composer test` runs Pest against `musichub_test`; `pnpm --filter web test:e2e` passes headless in Chromium.
- **Tests:** the suites themselves; a deliberately failing assertion makes the command exit non-zero (checked once).

### S1-10 GitHub Actions CI
- **Description:** `.github/workflows/ci.yml` on PR and `main`, with concurrency cancel.
  - Job `js`: Node from `.nvmrc`, corepack, pnpm cache, `pnpm install --frozen-lockfile`, `format:check`, `turbo run lint typecheck test build`, depcruise, codegen drift check (`git diff --exit-code`).
  - Job `php`: `shivammathur/setup-php` 8.4, Composer cache, Pint `--test`, Larastan, Pest with `postgres:18` and `redis` services.
  - Job `e2e`: Playwright smoke (Chromium) after `js`.
- **Acceptance:** all jobs are green on a PR. A lint error, a failing test and a codegen drift each make CI red (verified on a throw-away branch). Runtime < 10 min.
- **Tests:** the workflow itself; `actionlint` locally (optional).

### S1-11 Base shared package (`music-model` skeleton) + boundary enforcement
- **Description:** `packages/music-model` with the `library` tsconfig, ESLint base, Vitest, `build` (tsc), subpath export layout (`.`, `./schema`, `./timeline`, `./contracts`) and only the public constant `MHD_FORMAT = 'musichub'` / `MHD_SCHEMA_VERSION = 1`. The real schema comes in Sprint 2. `apps/web` imports it once to prove the wiring. dependency-cruiser rules are active in CI.
- **Acceptance:** `pnpm --filter music-model build test` passes; web build consumes it; depcruise forbids `music-model → react|@coderline/alphatab|dom`.
- **Tests:** one unit test of the exported constants; depcruise probe.

### S1-12 OpenAPI contract & `api-client` codegen
- **Description:** `openapi/openapi.yaml` (3.1) with `info`, servers, the problem-details schema and `GET /health`. `packages/api-client` generated with `openapi-typescript` + a thin `openapi-fetch` wrapper. Turbo `codegen` task; generated output is committed. The Laravel test validates the health response against the spec.
- **Acceptance:** changing the spec and running `pnpm codegen` updates types; the web health page uses the generated client; CI fails on drift; the Pest contract test fails if the health JSON deviates.
- **Tests:** `pnpm codegen && git diff --exit-code`; Pest contract test.

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

## Sprint 2 — Spikes & model draft (preview)

S1–S7 spikes (MUSIC_ENGINE.md §10), MHD v1 schema draft + fixtures, ADR‑0002/0004 finalised, design-token skeleton. Planned in detail after Sprint 1 review.
