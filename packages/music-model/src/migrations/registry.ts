// The real MHD migration registry (MUSIC_ENGINE.md §3.4, ADR-0002 Amendment 11): one pure step
// per source version N, keyed by N, migrating vN to vN+1. Each step lives in its own file
// `migrations/vN_to_vN+1.ts`. MHD v1 is the first version, so there is no step yet. MHD v1 is not
// declared stable (ADR-0002 A24); a real v2 and its step are added only by a later owner decision.
import type { MigrationSteps } from './migrator.js';

export const MIGRATIONS: MigrationSteps = Object.freeze({});
