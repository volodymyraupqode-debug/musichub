// Shared helper for the two presets that lift the base preset's alphaTab import ban:
// `music-engine.js` (packages/music-engine, the only production alphaTab boundary) and
// `spike.js` (throw-away spikes). Every other base rule stays in force.
import base from './base.js';

const ALPHATAB_GROUP = '@coderline/alphatab';

/** `no-restricted-imports` options of the base preset without the alphaTab pattern group. */
export function restrictedImportsWithoutAlphaTab() {
  return withoutAlphaTab(restrictedImportOptions());
}

/** Options of `no-restricted-imports` declared by the base preset. */
function restrictedImportOptions() {
  for (const entry of base) {
    const rule = entry.rules?.['no-restricted-imports'];
    if (Array.isArray(rule)) return rule.slice(1);
  }
  throw new Error(
    'base preset no longer declares no-restricted-imports; update alphatab-restriction.js.',
  );
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
