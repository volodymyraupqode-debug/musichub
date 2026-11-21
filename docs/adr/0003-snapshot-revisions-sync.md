# ADR-0003: Snapshot revisions with optimistic concurrency for sync

- **Status:** Accepted
- **Date:** 2026-11-21
- **Spec sections:** ARCHITECTURE.md §6; API.md §5; DATABASE.md §3.5

## Context

Compositions are edited by a single author on several devices; offline editing must not lose data.

## Decision

- Each save stores a full gzip snapshot as a new revision in object storage; PostgreSQL keeps metadata and SHA-256.
- Writes require `If-Match: "<baseRevision>"`; a mismatch returns `409` and the user chooses reload, overwrite or save-as-copy. No automatic merge in v1.
- Autosave ≥ 30 s idle (max every 2 min) with revision kinds and tiered thinning.

## Consequences

- Simple and debuggable; storage grows, mitigated by thinning and hash dedupe.

## Alternatives considered

- CRDT/OT real-time collaboration: post-v1.
- Command-log sync: possible later; needs a new ADR.
