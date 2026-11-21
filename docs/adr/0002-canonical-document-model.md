# ADR-0002: Own canonical document model (MHD) instead of alphaTab Score/JSON

- **Status:** Accepted (adapter strategy A vs B is finalised by spike S2 in Sprint 2)
- **Date:** 2026-11-21
- **Spec sections:** MUSIC_ENGINE.md §1–4; ARCHITECTURE.md §1.2

## Context

alphaTab is a rendering/playback SDK, not an editor. Its docs warn that direct model mutation can break rendering, and `JsonConverter` output is generated and unversioned.

## Decision

- Persist only the MusicHub Document (MHD), versioned via `schemaVersion` with migrations (`packages/music-model`).
- alphaTab is an adapter in `packages/music-engine` only: a fresh `Score` is built per change and `finish()` is called; alphaTab objects and IDs are never persisted.

## Consequences

- We own the editor, IDs, undo/redo and serialization. Import/export needs a coverage matrix and round-trip tests.

## Alternatives considered

- Persisting alphaTab JSON: rejected (no stability guarantee).
- Mutating alphaTab's Score as the editing model: rejected (documented as unsafe).
