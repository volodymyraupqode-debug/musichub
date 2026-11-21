# ADR-0001: Modular monolith; Laravel as a standalone Composer project

- **Status:** Accepted
- **Date:** 2026-11-21
- **Spec sections:** ARCHITECTURE.md §1, §3.3, §5; PROJECT_SPEC.md §3

## Context

MusicHub needs a web app, an API, background jobs and later mobile apps. Microservices are explicitly out of scope for v1.

## Decision

- One Laravel 13 API (`apps/api`) with internal modules (`app/Modules/<Module>`) plus queue workers from the same codebase. One Next.js app (`apps/web`). A Node `music-worker` only when server-side music processing is needed (Phase 8).
- `apps/api` is a standalone Composer project: not a pnpm workspace member, not orchestrated by Turborepo, no Laravel frontend scaffold.
- Cross-language contracts are files: `openapi/openapi.yaml` and (later) the generated MHD envelope JSON Schema.

## Consequences

- Simple deployment and debugging. Modules must keep clear boundaries inside the monolith.
- CI has separate JS and PHP jobs.

## Alternatives considered

- Microservices: rejected (premature, operational cost).
- Laravel inside the pnpm workspace: rejected (mixes package managers, Laravel's Vite scaffold is unused).
