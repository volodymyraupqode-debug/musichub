# MusicHub API (`apps/api`)

Laravel 13 API-only application. It is a **standalone Composer project**: not part of the pnpm workspace or Turborepo (ARCHITECTURE.md §3.3).

- Routes: `routes/api.php`, served under `/api/v1`. Errors are RFC 9457 problem details (`app/Http/Problems`).
- Modules: `app/Modules/<Module>` (ARCHITECTURE.md §5). Sprint 1 has only `System` (health).
- Contract: `../../openapi/openapi.yaml`.

## Requirements

PHP **8.4** (`composer.json` requires `^8.4`; CI uses 8.4) with `pdo_pgsql`, `redis`, `intl`, `zip`. With Laravel Herd the default `php` may be older: use `php84` for every command (`php84 artisan …`, `php84 "$(which composer)" …`). `herd isolate` is not needed (ADR-0006 D3).

## Commands

| Command | What |
|---|---|
| `composer install` | install dependencies |
| `php artisan migrate` | run migrations (enables `citext`, `pg_trgm`) |
| `php artisan serve --port 8000` | run the API |
| `composer format` | Pint (fix) |
| `composer lint` | Pint `--test` + Larastan (level 8) |
| `composer test` | Pest against PostgreSQL `musichub_test` (never SQLite) |

Services (PostgreSQL, Redis, Mailpit, SeaweedFS S3) come from `../../infra/docker-compose.yml`. `composer test` needs them running: `tests/Feature/S3StorageTest.php` talks to the real SeaweedFS and fails with a clear message if it is down.

## Notes

- The standard queue migration is kept: with the Redis queue driver the `jobs` table is unused, while `failed_jobs` stores failed jobs (DATABASE.md §3.14).
- The health test (`tests/Feature/HealthTest.php`) checks the response shape by hand. Full OpenAPI schema validation of responses is a Phase 4 task.
