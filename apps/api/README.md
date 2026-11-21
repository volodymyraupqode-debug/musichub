# MusicHub API (`apps/api`)

Laravel 13 API-only application. It is a **standalone Composer project**: not part of the pnpm workspace or Turborepo (ARCHITECTURE.md §3.3).

- Routes: `routes/api.php`, served under `/api/v1`. Errors are RFC 9457 problem details (`app/Http/Problems`).
- Modules: `app/Modules/<Module>` (ARCHITECTURE.md §5). Sprint 1 has only `System` (health).
- Contract: `../../openapi/openapi.yaml`.

## Requirements

PHP **8.4** (`composer.json` requires `^8.4`) with `pdo_pgsql`, `redis`, `intl`, `zip`. With Laravel Herd the default `php` may be older; use `php84` and run Composer as `php84 "$(which composer)" …`.

## Commands

| Command | What |
|---|---|
| `composer install` | install dependencies |
| `php artisan migrate` | run migrations (enables `citext`, `pg_trgm`) |
| `php artisan serve --port 8000` | run the API |
| `composer format` | Pint (fix) |
| `composer lint` | Pint `--test` + Larastan (level 8) |
| `composer test` | Pest against PostgreSQL `musichub_test` (never SQLite) |

Services (PostgreSQL, Redis, Mailpit) come from `../../infra/docker-compose.yml`.
