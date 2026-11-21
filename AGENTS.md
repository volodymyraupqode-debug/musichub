# AGENTS.md

Entry point for AI coding agents working on **MusicHub** (final product name; see PROJECT_SPEC.md §1.1 naming rules) — a web-first music creation & community platform (tablature + notation editor, multi-track playback, Piano Visualizer, Piano Roll, MIDI, library, community; mobile later).

> Project status: **specification v0.2 (audited), awaiting approval.** Only T0.1 tooling exists (root workspace + `packages/config`, uncommitted). Do not start Sprint 1 tasks until the owner approves ROADMAP.md §Sprint 1.

## Read first

1. [AGENT_RULES.md](AGENT_RULES.md) — full rules (mandatory).
2. [PROJECT_SPEC.md](PROJECT_SPEC.md) — scope, constraints, risks, open questions.
3. [ROADMAP.md](ROADMAP.md) — current phase and task order.
4. Task-specific docs: [ARCHITECTURE.md](ARCHITECTURE.md) · [DATABASE.md](DATABASE.md) · [API.md](API.md) · [MUSIC_ENGINE.md](MUSIC_ENGINE.md) · [PIANO_VISUALIZER.md](PIANO_VISUALIZER.md) · [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) · [MOBILE.md](MOBILE.md)

## Stack

Node 26 LTS · pnpm 12.21 · Next.js 16 (Turbopack) · React 19 · TypeScript 6.0 strict · Laravel 13 (PHP 8.4) · PostgreSQL 18 · Redis · alphaTab **1.9.0 (pinned)** · Zustand · TanStack Query · Zod · React Hook Form · shadcn/ui (Tailwind v4) · Vitest · Playwright · Web Audio / Web MIDI / Canvas 2D · Expo SDK 58 · Docker Compose · pnpm + Turborepo 2.

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
- Shared presets live in `packages/config`: `@musichub/config/tsconfig/base.json`, `@musichub/config/tsconfig/library.json` (pure packages, no DOM), `@musichub/config/eslint` (includes the alphaTab import restriction — `packages/music-engine` overrides it).

## Commands

```
pnpm install        # install workspace
pnpm lint           # turbo run lint
pnpm typecheck      # turbo run typecheck
pnpm test           # turbo run test
pnpm build          # turbo run build
pnpm format:check   # prettier (Markdown specs are excluded)
```

Docker Compose, app dev servers and PHP commands are added by Sprint 1 tasks (ROADMAP.md).
