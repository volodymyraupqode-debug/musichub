# Local services

`docker-compose.yml` runs the services the API needs in development (ARCHITECTURE.md §8).

| Service | Image | Host port (env var) | Notes |
|---|---|---|---|
| postgres | `postgres:18-alpine` | 54320 (`POSTGRES_PORT`) | DBs `musichub` and `musichub_test`; user/password `musichub` (dev only) |
| redis | `redis:8-alpine` | 6379 (`REDIS_PORT`) | AOF persistence |
| mailpit | `axllent/mailpit:v1.27` | SMTP 1025 (`MAILPIT_SMTP_PORT`), UI 8025 (`MAILPIT_UI_PORT`) | catches all outgoing mail |
| seaweedfs | `chrislusf/seaweedfs:4.54` | S3 API 8333 (`S3_PORT`) | Single node (`weed mini`), ADR-0007. Credentials from `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` (local-only defaults) |
| seaweedfs-init | `chrislusf/seaweedfs:4.54` | — | One-shot: creates bucket `S3_BUCKET` (default `musichub-local`) if missing, verifies it is listed, exits 0; bounded retries (6 attempts, 10 s per `weed shell` call), exits 1 with the last `weed shell` output otherwise |

The optional `full` profile (API and Horizon containers) is deferred to Phase 4; the API runs on the host with PHP 8.4.

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

`up --wait` returns once SeaweedFS is healthy; it does not wait for the one-shot `seaweedfs-init`. To run the bucket bootstrap and wait for its result (idempotent, exits non-zero if the bucket cannot be created; this is what CI does):

```bash
docker compose -f infra/docker-compose.yml run --rm seaweedfs-init
```

Check that the S3 API is healthy:

```bash
curl -fsS http://localhost:8333/healthz
```

List buckets directly in SeaweedFS:

```bash
docker compose -f infra/docker-compose.yml exec seaweedfs sh -c 'echo s3.bucket.list | weed shell -master=localhost:9333'
```

Reset only the object storage (deletes all stored objects; the bucket is recreated on the next `up`):

```bash
docker compose -f infra/docker-compose.yml rm -sf seaweedfs seaweedfs-init && docker volume rm musichub_seaweedfs-data
```

Reset everything, deleting all data volumes. `postgres/init/*.sql` runs again on the next start:

```bash
docker compose -f infra/docker-compose.yml down -v
```
