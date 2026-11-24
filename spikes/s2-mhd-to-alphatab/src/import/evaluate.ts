// Spike S4 (ROADMAP S2-09): import-fidelity evaluation. Compares the musical semantics of an
// imported alphaTab Score with the intended MHD content, per fact group (facts.ts), as multisets.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as alphaTab from '@coderline/alphatab';
import type { MhdDocument } from '@musichub/music-model';
import { mhdComparable, projectToMhd, scoreFacts, type Facts } from '../facts.ts';
import { newSettings } from '../run.ts';

export const FIXTURE_DIR = path.resolve(import.meta.dirname, '../../fixtures/import');

/** Imports a fixture with alphaTab's ScoreLoader (format detected by alphaTab). */
export function importFixture(relative: string): alphaTab.model.Score {
  const bytes = new Uint8Array(readFileSync(path.join(FIXTURE_DIR, relative)));
  return alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, newSettings());
}

export type Status = 'supported' | 'partial' | 'unsupported' | 'not exercised' | 'not evaluated';

export interface GroupResult {
  group: string;
  status: Status;
  expected: number;
  matched: number;
  /** Expected entries alphaTab did not produce, and produced entries not expected (all of them). */
  missing: unknown[];
  unexpected: unknown[];
}

/** Multiset comparison of two fact lists (JSON equality, no tolerance). */
export function compareGroup(
  group: string,
  expected: unknown[] = [],
  actual: unknown[] = [],
): GroupResult {
  const pool = new Map<string, number>();
  for (const a of actual) pool.set(JSON.stringify(a), (pool.get(JSON.stringify(a)) ?? 0) + 1);
  const missing: unknown[] = [];
  let matched = 0;
  for (const e of expected) {
    const k = JSON.stringify(e);
    const c = pool.get(k) ?? 0;
    if (c > 0) {
      pool.set(k, c - 1);
      matched++;
    } else missing.push(e);
  }
  const unexpected: unknown[] = [];
  for (const [k, c] of pool) for (let i = 0; i < c; i++) unexpected.push(JSON.parse(k));
  const status: Status =
    expected.length === 0 && actual.length === 0
      ? 'not exercised'
      : missing.length === 0 && unexpected.length === 0
        ? 'supported'
        : matched === 0
          ? 'unsupported'
          : 'partial';
  return { group, status, expected: expected.length, matched, missing, unexpected };
}

/**
 * Fact groups compared for an import. `trackInfo` is reduced to name, MIDI program and percussion:
 * MusicXML mixer defaults (volume, pan) are engine defaults, not content of the fixtures.
 */
export const GROUPS = [
  'structure',
  'trackInfo',
  'staffDisplay',
  'tuning',
  'transposition',
  'clef',
  'timeSignature',
  'keySignature',
  'tempo',
  'anacrusis',
  'repeats',
  'alternateEndings',
  'directions',
  'sections',
  'fermata',
  'voices',
  'rhythm',
  'grace',
  'rests',
  'chords',
  'pitch',
  'ties',
  'percussion',
  'soundingPitch',
] as const;

function reduce(f: Facts): Facts {
  return {
    ...f,
    trackInfo: (f.trackInfo ?? []).map((t) => {
      const a = t as unknown[];
      return [a[0], a[1], a[7]];
    }),
    // Sounding pitch per note position, without string and fret (round trip: see report §6.3).
    soundingPitch: (f.pitch ?? []).map((p) => (p as unknown[]).slice(0, 7)),
  };
}

/** Intent (MHD) against an alphaTab Score, in the shapes of `mhdComparable`. */
export function compareWithIntent(
  intent: MhdDocument,
  score: alphaTab.model.Score,
  notEvaluated: Record<string, string> = {},
) {
  const expected = reduce(mhdComparable(intent));
  const actual = reduce(projectToMhd(scoreFacts(score)));
  return skip(
    GROUPS.map((g) => compareGroup(g, expected[g], actual[g])),
    notEvaluated,
  );
}

/** Marks groups the intent does not define (open MHD questions) as not evaluated. */
function skip(results: GroupResult[], notEvaluated: Record<string, string>): GroupResult[] {
  return results.map((r) =>
    r.group in notEvaluated ? { ...r, status: 'not evaluated', missing: [], unexpected: [] } : r,
  );
}

/** Two alphaTab Scores against each other (round trip), in the same shapes. */
export function compareScores(before: alphaTab.model.Score, after: alphaTab.model.Score) {
  const a = reduce(projectToMhd(scoreFacts(before)));
  const b = reduce(projectToMhd(scoreFacts(after)));
  return GROUPS.map((g) => compareGroup(g, a[g], b[g]));
}

/** MHD against MHD (intent against the converted document), in the shapes of `mhdComparable`. */
export function compareDocuments(
  expected: MhdDocument,
  actual: MhdDocument,
  notEvaluated: Record<string, string> = {},
) {
  const a = reduce(mhdComparable(expected));
  const b = reduce(mhdComparable(actual));
  const ea = extras(expected);
  const eb = extras(actual);
  return skip(
    [
      ...GROUPS.map((g) => compareGroup(g, a[g], b[g])),
      compareGroup('dynamics', ea.dynamics, eb.dynamics),
      compareGroup('noteEffects', ea.effects, eb.effects),
      compareGroup('lyrics', ea.lyrics, eb.lyrics),
    ],
    notEvaluated,
  );
}

/** Beat dynamics and note effects of an MHD document (not part of the facts.ts groups). */
export function extras(doc: MhdDocument): {
  dynamics: unknown[];
  effects: unknown[];
  lyrics: unknown[];
} {
  const dynamics: unknown[] = [];
  const effects: unknown[] = [];
  const lyrics: unknown[] = [];
  for (const [ti, t] of doc.tracks.entries())
    for (const [si, s] of t.staves.entries())
      for (const [bi, b] of s.bars.entries())
        for (const [vi, v] of b.voices.entries())
          for (const [bti, bt] of v.beats.entries()) {
            if (bt.dynamic) dynamics.push([ti, si, bi, vi, bti, bt.dynamic]);
            if (bt.lyrics) lyrics.push([ti, si, bi, vi, bti, bt.lyrics]);
            for (const [ni, n] of bt.notes.entries())
              if (n.effects) effects.push([ti, si, bi, vi, bti, ni, n.effects]);
          }
  return { dynamics, effects, lyrics };
}
