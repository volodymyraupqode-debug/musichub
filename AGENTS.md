# AGENTS.md

Entry point for AI coding agents working on **MusicHub** (final product name; see PROJECT_SPEC.md §1.1 naming rules) — a web-first music creation & community platform (tablature + notation editor, multi-track playback, Piano Visualizer, Piano Roll, MIDI, library, community; mobile later).

> Project status: **Sprint 2 (Spikes & model draft) in progress** (ROADMAP.md §Sprint 2). Done: Sprint 1, S2-00…S2-04 (MHD v1 schema and canonical fixtures in `packages/music-model`; spike S1, alphaTab under Turbopack, in `spikes/s1-turbopack`). S2-05 (spike S2, MHD → alphaTab strategy, `spikes/s2-mhd-to-alphatab`) is in review. Later Sprint 2 tasks are TBD and need owner approval. No playback, rendering or editor features exist yet.

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
pnpm dev                                  # all dev servers (web on :3000)
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
