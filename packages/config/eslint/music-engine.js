// ESLint preset for packages/music-engine, the only package allowed to import alphaTab
// (AGENT_RULES.md §4, ARCHITECTURE.md §3.1). It is the base preset with one change: alphaTab
// may be imported. Every other rule stays. dependency-cruiser enforces the same boundary
// (rule `alphatab-only-in-music-engine`) and allows this preset only in packages/music-engine.
// Usage in packages/music-engine/eslint.config.js:
//   import { musicEngineConfig } from '@musichub/config/eslint/music-engine';
//   export default musicEngineConfig(import.meta.dirname);
import path from 'node:path';
import { defineConfig } from 'eslint/config';
import { restrictedImportsWithoutAlphaTab } from './alphatab-restriction.js';
import base from './base.js';

const musicEngineDir = path.resolve(import.meta.dirname, '../../music-engine');

/**
 * @param {string} packageDir Directory of the package (`import.meta.dirname`).
 */
export function musicEngineConfig(packageDir) {
  if (path.resolve(packageDir) !== musicEngineDir) {
    throw new Error(
      `@musichub/config/eslint/music-engine is only for packages/music-engine (got ${packageDir}).`,
    );
  }
  return defineConfig(base, {
    rules: { 'no-restricted-imports': ['error', ...restrictedImportsWithoutAlphaTab()] },
  });
}
