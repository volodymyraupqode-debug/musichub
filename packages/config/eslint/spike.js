// ESLint preset for throw-away spike packages in spikes/* (MUSIC_ENGINE.md §10, spikes/README.md).
// It is the base preset with one change: alphaTab may be imported. Every other rule stays.
// Usage in spikes/<name>/eslint.config.js:
//   import { spikeConfig } from '@musichub/config/eslint/spike';
//   export default spikeConfig(import.meta.dirname);
import path from 'node:path';
import { defineConfig } from 'eslint/config';
import base from './base.js';

const spikesRoot = path.resolve(import.meta.dirname, '../../../spikes');
const ALPHATAB_GROUP = '@coderline/alphatab';

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
    rules: { 'no-restricted-imports': ['error', ...withoutAlphaTab(restrictedImportOptions())] },
  });
}

/** Options of `no-restricted-imports` declared by the base preset. */
function restrictedImportOptions() {
  for (const entry of base) {
    const rule = entry.rules?.['no-restricted-imports'];
    if (Array.isArray(rule)) return rule.slice(1);
  }
  throw new Error('base preset no longer declares no-restricted-imports; update the spike preset.');
}

/**
 * Drops only the alphaTab pattern group and keeps any other restriction from the base preset.
 * @param {unknown[]} options
 */
function withoutAlphaTab(options) {
  return options.map((option) => {
    if (typeof option !== 'object' || option === null || !('patterns' in option)) return option;
    const patterns = /** @type {{ group?: string[] }[]} */ (option.patterns).filter(
      (pattern) => !pattern.group?.includes(ALPHATAB_GROUP),
    );
    return { ...option, patterns };
  });
}
