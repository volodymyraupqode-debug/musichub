// Runs both strategies on one document and compares the results (used by tests and scripts).
import * as alphaTab from '@coderline/alphatab';
import type { MhdDocument } from '@musichub/music-model';
import {
  diffGroup,
  mhdComparable,
  projectToMhd,
  scoreFacts,
  type FactDiff,
  type Facts,
} from './facts.ts';
import { toAlphaTabDirect, type StrategyAResult } from './strategy-a.ts';
import { toAlphaTabViaTex, type StrategyBResult } from './strategy-b.ts';

export function newSettings(): alphaTab.Settings {
  const settings = new alphaTab.Settings();
  settings.core.engine = 'svg';
  settings.core.enableLazyLoading = false;
  settings.core.logLevel = alphaTab.LogLevel.None;
  return settings;
}

export interface StrategyOutcome<R> {
  result?: R;
  error?: string;
  facts?: Facts;
  /** Differences against facts derived from MHD alone. */
  vsMhd: FactDiff[];
}

export interface Comparison {
  a: StrategyOutcome<StrategyAResult>;
  b: StrategyOutcome<StrategyBResult>;
  /** Differences between the two alphaTab results over all fact groups. */
  aVsB: FactDiff[];
}

function diffAll(expected: Facts, actual: Facts): FactDiff[] {
  const groups = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  return [...groups]
    .map((g) => diffGroup(g, expected[g], actual[g]))
    .filter((d): d is FactDiff => d !== null);
}

function outcome<R extends { renderScore: alphaTab.model.Score }>(
  run: () => R,
  expected: Facts,
): StrategyOutcome<R> {
  try {
    const result = run();
    const facts = scoreFacts(result.renderScore);
    return { result, facts, vsMhd: diffAll(expected, projectToMhd(facts)) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), vsMhd: [] };
  }
}

export function compare(doc: MhdDocument): Comparison {
  const expected = mhdComparable(doc);
  const a = outcome(() => toAlphaTabDirect(doc, newSettings()), expected);
  const b = outcome(() => toAlphaTabViaTex(doc, newSettings()), expected);
  const aVsB = a.facts && b.facts ? diffAll(a.facts, b.facts) : [];
  return { a, b, aVsB };
}
