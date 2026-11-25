# @musichub/music-engine — alphaTab adapter

The alphaTab adapter of MusicHub (MUSIC_ENGINE.md §1–§6, ARCHITECTURE.md §3.1): import and export, MHD ⇄ alphaTab Score, render controller, playback and the playback clock. MHD (`@musichub/music-model`) stays the only persisted music model; alphaTab objects, alphaTab JSON and alphaTab runtime ids are never persisted (AGENT_RULES.md §4).

**Status:** package boundary only (Phase 1, first pull request). There is no engine functionality yet; `fromAlphaTab`, `toAlphaTab`, `PlaybackController`, `PlaybackClock` and the exports follow in later Phase 1 pull requests, within the decisions recorded in ADR-0002 (A1–A18) and ADR-0004.

## alphaTab boundary

This is the **only** package that may import `@coderline/alphatab` (pinned to 1.9.0 through the pnpm catalog; ADR-0004). Throw-away spikes in `spikes/*` are the only other exception. ESLint and dependency-cruiser enforce it independently:

| Check | Where | Effect |
|---|---|---|
| ESLint `no-restricted-imports` | `@musichub/config/eslint/base` | rejects `@coderline/alphatab`, its subpaths and `@coderline/alphatab-*` in every package |
| ESLint preset `@musichub/config/eslint/music-engine` | `packages/config/eslint/music-engine.js` | the base preset without the alphaTab ban; throws when used outside this package |
| dependency-cruiser `alphatab-only-in-music-engine` | `.dependency-cruiser.cjs` | fails `pnpm depcruise` on any resolved alphaTab import outside this package and `spikes/*` |
| dependency-cruiser `music-engine-eslint-preset-only-in-music-engine` | `.dependency-cruiser.cjs` | fails `pnpm depcruise` when another package loads the music-engine ESLint preset |

`src/boundary.test.ts` checks the ESLint side against the real `eslint.config.js` of this package and of other packages.

The public API must not expose alphaTab types: consumers work with MHD and the shared contracts in `music-model` (MUSIC_ENGINE.md §3.6).

## Commands

```bash
pnpm --filter @musichub/music-engine lint
pnpm --filter @musichub/music-engine typecheck
pnpm --filter @musichub/music-engine test
pnpm --filter @musichub/music-engine build
```
