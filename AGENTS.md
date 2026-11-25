# AGENTS.md

Entry point for AI coding agents working on **MusicHub** (final product name; see PROJECT_SPEC.md §1.1 naming rules) — a web-first music creation & community platform (tablature + notation editor, multi-track playback, Piano Visualizer, Piano Roll, MIDI, library, community; mobile later).

> Project status: **Phase 0 complete (owner declaration 2026-11-25, Q0 Option C); Phase 1 not approved or started** (ROADMAP.md §Sprint 2, §Phase 0 *Exit status*). Done: Sprint 1, S2-00…S2-07 (MHD v1 schema and canonical fixtures in `packages/music-model`; spikes S1 alphaTab under Turbopack, S2 MHD → alphaTab strategy, S5 timeline parity, S7 playback-score variants). Done through fallback selection: S2-08 (S6 audio clock): the < 10 ms jitter target was not met in every tested configuration (headless WebKit exceeds it at the default 10 ms interval in 3 of 4 speed-1.0 runs), and the owner accepted the documented audio-anchored clock fallback on 2026-11-25 (ADR-0004 Addendum 2, MUSIC_ENGINE.md §5.1), which meets the ROADMAP exit criterion's "or a fallback is chosen" alternative; physical audio-output accuracy is unverified, and the fallback is not implemented yet: Phase 1 must build and validate it in `packages/music-engine`. Partly done: S2-09 (S4 import fidelity), S2-10 (S3 edit-loop latency). Done: S2-12 (Phase 0 evidence consolidation and exit audit). All three ROADMAP Phase 0 exit criteria are now met (clean clone verified, S6 through the fallback), and under the Q0 rule (owner decision 2026-11-25, Option C; ROADMAP.md §Phase 0) Phase 0 completion also needs a recorded owner disposition for each unmet MUSIC_ENGINE.md §10 spike (S3, S4, S5, S7). S5's is recorded (2026-11-25, ADR-0002 Amendment 5): D1 keeps invariant 7 with an implicit Playback Score `repeatStart` (unverified), D2 is rejected by validation, the timeline reports the MHD hi-hat key, [CONV] 1–3 are MHD rules, at most one segno and one coda; the default dynamic stays open until MHD v1 finalisation. The S5 parity criterion is **not** passed: Phase 1 must implement these rules and pass the timeline parity tests under them (ROADMAP.md §Phase 1). S3's is recorded (2026-11-25, ADR-0002 Amendment 6, Option B + D): the < 150 ms target (A9, unchanged) is **not** met and the gap is deferred to Phase 3 (Editor), measured there with the real `editor-core` and RenderScheduler on 300 × 8; Phase 1's `toAlphaTab`, render-controller and Playback Score design must keep a partial Render Score, off-main-thread conversion and MIDI regeneration on play feasible. S4's is recorded (2026-11-25, ADR-0002 Amendment 7, Option 2): the S4 criterion is unchanged and **not** met; Phase 1 owns the production importer, coverage matrix, golden round-trip tests on legally usable MusicXML fixtures and the recorded import findings, and Phase 7 owns independent GP3–GP8 evidence before v1.0 (missing GP evidence is not evidence of incompatibility; the spike converter is not production code). S7's is recorded (2026-11-25, ADR-0002 Amendment 8, Option B1): the S7 criterion is **not** met; Phase 1 owns sustain-pedal playback (audible check, MUSIC_ENGINE.md §5.2 pedal variant if needed) and Phase 2 the hand-split playback score with audible verification. Every unmet spike has a recorded disposition, and the owner declared Phase 0 complete on 2026-11-25 (ROADMAP.md §Phase 0); no spike criterion is thereby passed. Phase 1 is not approved or started; no Phase 1 implementation may begin until the owner explicitly approves it. A disposition is not proof that a criterion was met. S2-11 and S2-13 are TBD and need owner approval. Spike code lives in `spikes/` (`s1-turbopack`, `s2-mhd-to-alphatab` with S2/S3/S4/S5/S7, `s6-audio-clock`); no playback, rendering or editor features exist in the apps or packages yet.

## Read first

1. [AGENT_RULES.md](AGENT_RULES.md) — full rules (mandatory).
2. [PROJECT_SPEC.md](PROJECT_SPEC.md) — scope, constraints, risks, open questions.
3. [ROADMAP.md](ROADMAP.md) — current phase and task order.
4. Task-specific docs: [ARCHITECTURE.md](ARCHITECTURE.md) · [DATABASE.md](DATABASE.md) · [API.md](API.md) · [MUSIC_ENGINE.md](MUSIC_ENGINE.md) · [PIANO_VISUALIZER.md](PIANO_VISUALIZER.md) · [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) · [MOBILE.md](MOBILE.md)

## Stack

Node 26 LTS · pnpm 12.21 · Next.js 16.4 (Turbopack) · React 19.3 · TypeScript 6.0 strict · ESLint 10 · Laravel 13 (PHP 8.4) · PostgreSQL 18 · Redis · alphaTab **1.9.0 (pinned)** · Zustand · TanStack Query · Zod · React Hook Form · shadcn/ui (Tailwind v4) · Vitest · Playwright · Web Audio / Web MIDI / Canvas 2D · Expo SDK 58 · Docker Compose · pnpm + Turborepo 2.

## Repository layout (target)

```
apps/web (Next.js)  apps/api (Laravel, Composer only — not in pnpm workspace)  apps/mobile (P8)  apps/music-worker (P8)
packages/config  music-model  editor-core  music-engine  midi-engine  practice-core  piano-visualizer
packages/design-tokens  ui  api-client
openapi/  infra/  docs/adr/  spikes/
```

## Non-negotiables

- Persist only the MusicHub Document (MHD). alphaTab is an adapter for import/render/playback/export — never the storage model.
- Only `packages/music-engine` imports alphaTab. Check MUSIC_ENGINE.md §2 before using any alphaTab API; never assume unlisted capabilities.
- `music-model`, `editor-core`, `practice-core` are pure TS (no DOM, React, alphaTab, I/O).
- Laravel (`apps/api`) is a standalone Composer project; never manage PHP deps with pnpm or add it to Turborepo.
- Per-frame visuals (cursor, visualizer, piano roll) read `PlaybackClock` in their own rAF loop — never via React state.
- No microservices or new infrastructure without an ADR. Only libraries approved in PROJECT_SPEC.md §5.1–5.2 (Three.js: not approved).
- Editor state = `editor-core` Zustand vanilla store; document changes only via commands.
- Mobile is native-first Expo: WebView only for notation (`ScoreView`); never port the web editor into a WebView (MOBILE.md §2).
- Specs and code change together; keep all docs consistent.
- Run lint, typecheck and tests before declaring done; report real results.

## Toolchain

- Node **26 LTS** from `.nvmrc` (`nvm use`). pnpm 12.21.0 is pinned via `packageManager`. Node 26 does not bundle Corepack: run `npm i -g corepack && corepack enable` once.
- `engineStrict: true` (in `pnpm-workspace.yaml`) makes `pnpm install` fail on any other Node major.
- TypeScript is pinned to **6.0.x**: typescript-eslint 8 supports `<6.1`; do not upgrade to TS 7 until it does.
- Shared presets live in `packages/config`: tsconfig `base`, `library` (pure packages, no DOM), `react-library`, `nextjs`; ESLint `@musichub/config/eslint/base` (strict TS, no `any`, alphaTab import ban; `packages/music-engine` overrides it), `/eslint/react` (React, Hooks, jsx-a11y), `/eslint/next`, `/eslint/spike` (base without the alphaTab ban; only for `spikes/*`, see spikes/README.md); Vitest `@musichub/config/vitest/node` and `/vitest/jsdom` (v8 coverage).

## Commands

JS (repository root):

```
pnpm install --frozen-lockfile
pnpm dev                                  # all dev servers (web on :3000, spike S1 on :3200)
pnpm turbo run dev --filter=@musichub/web # web only (builds its workspace dependencies first)
pnpm format:check                         # Prettier (Markdown specs and generated code excluded)
pnpm turbo run lint typecheck test build  # all JS packages
pnpm depcruise                            # package boundary rules (.dependency-cruiser.cjs)
pnpm codegen                              # openapi/openapi.yaml → packages/api-client/src/generated
pnpm test:e2e                             # Playwright smoke (builds web first)
```

PHP (`apps/api`, PHP 8.4; with Herd use `php84`):

```
composer install
composer lint      # Pint --test + Larastan level 8
composer test      # Pest on PostgreSQL musichub_test
php artisan serve --port 8000
```

Services: `docker compose -f infra/docker-compose.yml up -d --wait` (PostgreSQL, Redis, Mailpit, SeaweedFS S3 on :8333 with bucket `musichub-local`; see infra/README.md). Pest includes a real S3 integration test, so the stack must be up..

## Gotchas

- `eslint-plugin-react` needs an explicit React version on ESLint 10 (`packages/config/eslint/react.js`). Keep it in sync with the `react` catalog entry.
- Peer-range exceptions verified to work are listed in `pnpm-workspace.yaml` → `peerDependencyRules`. Do not add new ones without verifying.
- Tool versions come from the pnpm `catalog:`; add new shared deps there. One TypeScript (6.0.3) and one ESLint (10.x) for the whole repo (ADR-0006).
- The health contract test is a shape check, not OpenAPI validation. Do not describe it as full validation.
- Local object storage is SeaweedFS (ADR-0007). Never add MinIO or a self-built MinIO image.
