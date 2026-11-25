// ESLint preset for throw-away spike packages in spikes/* (MUSIC_ENGINE.md §10, spikes/README.md).
// It is the base preset with one change: alphaTab may be imported. Every other rule stays.
// Usage in spikes/<name>/eslint.config.js:
//   import { spikeConfig } from '@musichub/config/eslint/spike';
//   export default spikeConfig(import.meta.dirname);
import path from 'node:path';
import { defineConfig } from 'eslint/config';
import { restrictedImportsWithoutAlphaTab } from './alphatab-restriction.js';
import base from './base.js';

const spikesRoot = path.resolve(import.meta.dirname, '../../../spikes');

/**
 * @param {string} packageDir Directory of the spike package (`import.meta.dirname`).
 */
export function spikeConfig(packageDir) {
  const relative = path.relative(spikesRoot, path.resolve(packageDir));
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(
      `@musichub/config/eslint/spike is only for packages inside spikes/ (got ${packageDir}).`,
    );
  }
  return defineConfig(base, {
    rules: { 'no-restricted-imports': ['error', ...restrictedImportsWithoutAlphaTab()] },
  });
}
