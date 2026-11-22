# MusicHub

**MusicHub** is a platform for creating, editing, playing, learning and sharing music. It includes a music editor, a Guitar Tab Editor, a Piano Visualizer and a Community (PROJECT_SPEC.md §1).

> Status: Sprint 1 (Foundation). No music features yet; see [ROADMAP.md](ROADMAP.md).
> AI agents: start with [AGENTS.md](AGENTS.md).

## Repository

| Path | What |
|---|---|
| `apps/web` | Next.js 16 web app (App Router, Turbopack) |
| `apps/api` | Laravel 13 API: standalone Composer project, not in the pnpm workspace |
| `packages/config` | Shared tsconfig, ESLint and Vitest presets |
| `packages/music-model` | MusicHub Document model (skeleton) |
| `packages/api-client` | Typed API client generated from `openapi/openapi.yaml` |
| `infra/` | Docker Compose services for local development |
| `docs/` | ADRs, glossary |
| `*.md` (root) | Product and technical specification |

## Prerequisites

- Node.js 26 LTS (`nvm use` reads `.nvmrc`) and Corepack (`npm i -g corepack && corepack enable`; Node 26 does not bundle it)
- PHP 8.4 with `pdo_pgsql`, `redis`, `intl`, `zip`, plus Composer 2 (e.g. Laravel Herd: use `php84`)
- Docker with Compose v2

## Quick start (clean clone)

```bash
nvm use && corepack enable
pnpm install --frozen-lockfile
docker compose -f infra/docker-compose.yml up -d --wait
```

API (in `apps/api`, with PHP 8.4 as `php`; on Herd replace `php` by `php84`):

```bash
cd apps/api && composer install && cp .env.example .env && php artisan key:generate && php artisan migrate && php artisan serve --port 8000
```

Web (second terminal, repository root):

```bash
cp apps/web/.env.example apps/web/.env.local && pnpm --filter @musichub/web dev
```

Open http://localhost:3000. It shows `API: ok` when the API and its PostgreSQL/Redis are up.

## Checks

```bash
pnpm format:check && pnpm turbo run lint typecheck test build && pnpm depcruise
```

```bash
cd apps/api && composer lint && composer test
```

```bash
pnpm test:e2e
```

CI runs the same checks (`.github/workflows/ci.yml`).

<!-- CI verification probe (S2-00): neutral change on branch ci/verify-red-checks; this branch is never merged. -->
