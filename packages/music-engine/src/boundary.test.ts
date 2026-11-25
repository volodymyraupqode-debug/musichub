// Package boundary checks (ROADMAP.md §Phase 1, PR 1): alphaTab is importable here and only here.
// The ESLint checks lint probe text against the real eslint.config.js of each package; ESLint 10
// looks the config up from the linted file's location. Vitest runs with this package as cwd.
import { model } from '@coderline/alphatab';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const VALUE_IMPORT =
  "import { model } from '@coderline/alphatab';\nexport const score = new model.Score();\n";
const TYPE_IMPORT =
  "import type { model } from '@coderline/alphatab';\nexport type S = model.Score;\n";
const SUBPATH_EXPORT = "export * from '@coderline/alphatab/core';\n";

// One instance for all cases: the first lint loads the configs and the TypeScript parser, which
// is slow when turbo runs other tasks in parallel.
const eslint = new ESLint();
const LINT_TIMEOUT_MS = 30_000;

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  if (!result) throw new Error(`no lint result for ${filePath}`);
  return result.messages.map((m) => m.ruleId ?? `fatal: ${m.message}`);
}

describe('alphaTab boundary', () => {
  it('resolves alphaTab inside packages/music-engine', () => {
    expect(new model.Score()).toBeInstanceOf(model.Score);
  });

  it(
    'allows alphaTab imports in packages/music-engine',
    async () => {
      for (const code of [VALUE_IMPORT, TYPE_IMPORT, SUBPATH_EXPORT]) {
        expect(await ruleIds(code, 'src/probe.ts')).not.toContain('no-restricted-imports');
      }
    },
    LINT_TIMEOUT_MS,
  );

  it(
    'keeps every other base rule in packages/music-engine',
    async () => {
      expect(await ruleIds('export const x: any = 1;\n', 'src/probe.ts')).toContain(
        '@typescript-eslint/no-explicit-any',
      );
    },
    LINT_TIMEOUT_MS,
  );

  it(
    'rejects alphaTab imports in other packages',
    async () => {
      for (const pkg of ['music-model', 'api-client']) {
        for (const code of [VALUE_IMPORT, TYPE_IMPORT, SUBPATH_EXPORT]) {
          expect(await ruleIds(code, `../${pkg}/src/probe.ts`)).toContain('no-restricted-imports');
        }
      }
    },
    LINT_TIMEOUT_MS,
  );
});
