# Spikes

Throw-away research code for Sprint 2 (MUSIC_ENGINE.md §10, ROADMAP.md Phase 0). Spike code is **not production code**: it answers one question, its results go into `docs/` and an ADR, and then the spike is deleted. Useful conclusions and tests are moved into the documentation or re-implemented in the production packages; spike code is never promoted as-is.

## Rules

- Each spike is its own pnpm workspace package in `spikes/<id>-<name>/` (for example `spikes/s1-turbopack/`), named `@musichub/spike-<id>-<name>` and `"private": true`.
- Spikes may import alphaTab and the shared `packages/*`. Apps and packages never import spikes, spikes never import apps or each other (dependency-cruiser, `.dependency-cruiser.cjs`).
- alphaTab stays banned everywhere else: only `packages/music-engine` and `spikes/*` may import it.
- Use only approved libraries (PROJECT_SPEC.md §5.1–5.2) through the pnpm catalog. alphaTab is pinned to 1.9.0.
- Lint, typecheck, test and format rules are the same as in production packages; only the alphaTab import ban is lifted.

## Creating a spike

1. Create `spikes/<id>-<name>/package.json`:

   ```json
   {
     "name": "@musichub/spike-s1-turbopack",
     "private": true,
     "type": "module",
     "scripts": { "lint": "eslint .", "typecheck": "tsc -p tsconfig.json --noEmit" },
     "dependencies": { "@coderline/alphatab": "catalog:", "zod": "catalog:" },
     "devDependencies": {
       "@musichub/config": "workspace:*",
       "eslint": "catalog:",
       "typescript": "catalog:"
     }
   }
   ```

2. Add `eslint.config.js`. The spike preset refuses to load outside `spikes/`:

   ```js
   import { spikeConfig } from '@musichub/config/eslint/spike';

   export default spikeConfig(import.meta.dirname);
   ```

3. Add a `tsconfig.json` extending a preset from `@musichub/config/tsconfig/*` and put the code in `src/`.
4. Run `pnpm install`, then `pnpm turbo run lint typecheck --filter=<package-name>` and `pnpm depcruise`.
5. Record the question, setup, numbers and conclusion in `docs/spikes/` before the spike is deleted.
