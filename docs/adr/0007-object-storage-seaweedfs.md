# ADR-0007: SeaweedFS as local S3-compatible object storage

- **Status:** Accepted and implemented (2026-11-21, PROJECT_SPEC.md Q22): `infra/docker-compose.yml` services `seaweedfs` + `seaweedfs-init`, Pest test `tests/Feature/S3StorageTest.php`, CI.
- **Date:** 2026-11-21
- **Spec sections:** ARCHITECTURE.md §2, §8; PROJECT_SPEC.md §5.2, Q22; infra/README.md

## Context

MusicHub stores document snapshots, uploads and avatars in S3-compatible object storage; production uses a managed S3 service. MinIO was the planned local service, but it no longer publishes container images: the Docker Hub repository `minio/minio` returns 404 and `quay.io/minio/minio` requires authentication (checked 2026-11-21).

## Decision

- **SeaweedFS** (`chrislusf/seaweedfs`, Apache-2.0) is the S3-compatible object storage for local development and CI.
- Single-node setup: one container running `weed mini` (master, volume, filer and S3 gateway in one process), S3 endpoint on port **8333**, one bucket `musichub-local`. Pin the image tag; the current release is **4.54** (tag verified on Docker Hub).
- Credentials come from the environment: `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in the container, fed by `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`. SeaweedFS uses them as a single global admin identity when no `-s3.config` exists, which is enough for single-user local development. CI sets its own values. Unauthenticated requests get 403 (verified). Without any credentials SeaweedFS runs in "Allow All" mode, which must not be used. A `-s3.config` JSON with scoped identities is the upgrade path if more identities are needed.
- Laravel keeps using the standard `s3` disk (`league/flysystem-aws-s3-v3`) through the S3 API. Only the endpoint changes; no SeaweedFS-specific code.
- MinIO is **no longer** the default option. Building MinIO from source into our own image is not allowed without a separate decision.
- **RustFS** (Apache-2.0) stays the alternative to re-evaluate later (e.g. if SeaweedFS fails a needed S3 feature).
- Production stays a managed S3 service (unchanged).

## Verified S3 support (SeaweedFS wiki "Amazon S3 API", 2026-11-21)

| Operation needed by MusicHub | SeaweedFS |
|---|---|
| CreateBucket / HeadBucket / ListBuckets | Yes |
| PutObject / GetObject (incl. range) / HeadObject | Yes |
| DeleteObject / DeleteObjects | Yes |
| CopyObject | Yes |
| ListObjectsV2 | Yes |
| Multipart upload (Create, UploadPart, Complete, Abort, ListParts) | Yes |
| Presigned URLs | Yes |
| Bucket lifecycle transitions, replication, notifications, website | No (not needed) |

**Verified by the Pest integration test** (`tests/Feature/S3StorageTest.php`, real SeaweedFS 4.54): put, exists, get, delete through the AWS SDK for PHP with path-style addressing, and a presigned (SigV4) temporary URL fetched over HTTP.

## Consequences

- No AGPL component in the local toolchain for storage (MinIO was AGPLv3).
- `apps/api/.env.example` points to `http://127.0.0.1:8333`.
- **Bucket bootstrap:** the one-shot `seaweedfs-init` service waits for `seaweedfs` to be healthy (`/healthz`), runs `infra/seaweedfs/create-bucket.sh` (`weed shell`: list, create only if missing, verify) and exits 0. Re-runs are idempotent. `weed shell s3.bucket.create` alone fails on an existing bucket, hence the list-first logic.

## Alternatives considered

- **RustFS** (Apache-2.0): MinIO-compatible API, newer project; kept as the fallback.
- **MinIO from source**: AGPLv3, our own image to maintain; rejected for now.
- **LocalStack**: a broader AWS emulator than needed; not evaluated further.
