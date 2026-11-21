# Local services

`docker-compose.yml` runs the services the API needs in development (ARCHITECTURE.md §8).

| Service | Image | Host port (env var) | Notes |
|---|---|---|---|
| postgres | `postgres:18-alpine` | 54320 (`POSTGRES_PORT`) | DBs `musichub` and `musichub_test`; user/password `musichub` (dev only) |
| redis | `redis:8-alpine` | 6379 (`REDIS_PORT`) | AOF persistence |
| mailpit | `axllent/mailpit:v1.27` | SMTP 1025 (`MAILPIT_SMTP_PORT`), UI 8025 (`MAILPIT_UI_PORT`) | catches all outgoing mail |
| S3 storage | — | — | **Pending:** MinIO no longer publishes images; a replacement needs owner approval (ROADMAP.md S1-07) |

PostgreSQL uses 54320 on the host, so it does not clash with a local PostgreSQL on 5432. Override ports by copying `.env.example` to `.env` in this folder.

## Commands (run from the repository root)

Start the services and wait until they are healthy:

```bash
docker compose -f infra/docker-compose.yml up -d --wait
```

Show their status:

```bash
docker compose -f infra/docker-compose.yml ps
```

Stop them (data is kept):

```bash
docker compose -f infra/docker-compose.yml down
```

Reset everything, deleting all data volumes. `postgres/init/*.sql` runs again on the next start:

```bash
docker compose -f infra/docker-compose.yml down -v
```
