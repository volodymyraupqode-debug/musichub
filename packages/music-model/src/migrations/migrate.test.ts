// MHD migration framework (MUSIC_ENGINE.md §3.4, ADR-0002 Amendment 11).
import { describe, expect, it } from 'vitest';
import band from '../../fixtures/v1/band-repeats.mhd.json' with { type: 'json' };
import guitar from '../../fixtures/v1/guitar-basic.mhd.json' with { type: 'json' };
import notation from '../../fixtures/v1/notation-semantics.mhd.json' with { type: 'json' };
import piano from '../../fixtures/v1/piano-grand-staff.mhd.json' with { type: 'json' };
import { MHD_SCHEMA_VERSION } from '../constants.js';
import * as root from '../index.js';
import type { MhdDocument } from '../schema/document.js';
import { deepFreeze, testId } from '../test-support/builders.js';
import { validateDocument, type ValidationResult } from '../validate/validate-document.js';
import { migrate } from './index.js';
import { createMigrator, type MigrationResult, type MigrationStep } from './migrator.js';
import { MIGRATIONS } from './registry.js';

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const FIXTURES: [string, unknown][] = [
  ['guitar-basic', guitar],
  ['piano-grand-staff', piano],
  ['band-repeats', band],
  ['notation-semantics', notation],
];

function expectOk(result: MigrationResult) {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}`);
  return result;
}
function expectError(result: MigrationResult) {
  if (result.ok) throw new Error('expected a migration error');
  return result.error;
}

describe('migrate: current version (identity)', () => {
  it.each(FIXTURES)('%s migrates with no step to a deep-equal copy', (_, fixture) => {
    const input = deepFreeze(copy(fixture));
    const result = expectOk(migrate(input));
    expect(result.fromVersion).toBe(1);
    expect(result.appliedSteps).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(result.document).toEqual(fixture);
    expect(result.document).not.toBe(input);
    expect(result.document.tracks[0]).not.toBe((input as MhdDocument).tracks[0]);
    expect(input).toEqual(fixture); // deep-frozen input: any mutation would have thrown
  });

  it('preserves extensions verbatim, as an independent copy', () => {
    const extensions = {
      'alphatab.unmapped': { GA0000000001: { nested: [1, 'two', null, { deep: true }], n: 1.5 } },
      'vendor.note': 'text',
      'vendor.keys': JSON.parse('{"__proto__": {"kept": true}, "constructor": 1}') as unknown,
    };
    const input = deepFreeze({ ...copy(guitar as unknown as MhdDocument), extensions });
    const result = expectOk(migrate(input));
    expect(result.document.extensions).toEqual(extensions);
    expect(Object.keys(result.document.extensions?.['vendor.keys'] as object)).toEqual([
      '__proto__',
      'constructor',
    ]);
    expect(result.document.extensions).not.toBe(input.extensions);
    expect(result.document.extensions?.['alphatab.unmapped']).not.toBe(
      input.extensions['alphatab.unmapped'],
    );
  });

  it('accepts a document with warnings only and returns them', () => {
    const doc = copy(guitar as unknown as MhdDocument);
    const first = doc.masterBars[0];
    if (!first) throw new Error('fixture has no master bar');
    doc.masterBars[0] = { ...first, fermatas: [{ position: [1, 7] }] };
    const expected = validateDocument(doc);
    expect(expected.valid).toBe(true);
    expect(expected.issues.map((i) => i.severity)).toEqual(['warning']);
    const result = expectOk(migrate(deepFreeze(doc)));
    expect(result.issues).toEqual(expected.issues);
  });
});

describe('migrate: rejections', () => {
  const valid = () => copy(guitar as unknown as Record<string, unknown>);

  it.each([
    ['null', null],
    ['an array', [guitar]],
    ['a string', '{"format":"musichub"}'],
    ['a number', 1],
    ['a boolean', true],
    ['undefined', undefined],
    [
      'missing format',
      (() => {
        const d = valid();
        delete d['format'];
        return d;
      })(),
    ],
    ['wrong format', { ...valid(), format: 'alphatab' }],
  ])('rejects %s as not-an-mhd-document', (_, input) => {
    expect(expectError(migrate(input))).toEqual({
      code: 'not-an-mhd-document',
      message: 'This file is not a MusicHub document.',
    });
  });

  it.each([
    ['missing', undefined],
    ['zero', 0],
    ['negative', -1],
    ['fractional', 1.5],
    ['a string', '1'],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['null', null],
  ])('rejects a %s schema version as invalid-schema-version', (_, version) => {
    const input = valid();
    if (version === undefined) delete input['schemaVersion'];
    else input['schemaVersion'] = version;
    expect(expectError(migrate(input))).toEqual({
      code: 'invalid-schema-version',
      message: 'The document has no valid schema version.',
    });
  });

  it.each([2, 99])(
    'rejects version %i as unsupported-schema-version without running a step',
    (version) => {
      const error = expectError(migrate({ ...valid(), schemaVersion: version }));
      expect(error).toEqual({
        code: 'unsupported-schema-version',
        message:
          'This document was created by a newer version of MusicHub. Update MusicHub to open it.',
        schemaVersion: version,
      });
      let calls = 0;
      const counting: MigrationStep = (doc) => {
        calls++;
        return { ...(doc as object), schemaVersion: 2 };
      };
      const migrator = createMigrator({
        currentVersion: 2,
        steps: { 1: counting },
        validate: () => ({ valid: true, issues: [], document: valid() as unknown as MhdDocument }),
      });
      expect(expectError(migrator({ ...valid(), schemaVersion: version + 1 })).code).toBe(
        'unsupported-schema-version',
      );
      expect(calls).toBe(0);
    },
  );

  it('rejects an invalid v1 document with the validator issues (duplicate id)', () => {
    const doc = copy(guitar as unknown as MhdDocument);
    const [first, second] = doc.masterBars;
    if (!first || !second) throw new Error('fixture has fewer than two master bars');
    doc.masterBars[1] = { ...second, id: first.id };
    const error = expectError(migrate(doc));
    expect(error.code).toBe('invalid-document');
    expect(error.schemaVersion).toBe(1);
    expect(error.issues).toEqual(validateDocument(doc).issues);
    expect(error.issues?.map((i) => i.code)).toContain('duplicate-id');
  });

  it('rejects an invalid v1 document with the validator issues (dangling slur)', () => {
    const doc = copy(notation as unknown as MhdDocument);
    const slurs = doc.tracks[0]?.slurs;
    if (!slurs?.[0]) throw new Error('fixture has no slur');
    slurs[0] = { ...slurs[0], to: testId() };
    const error = expectError(migrate(doc));
    expect(error.code).toBe('invalid-document');
    expect(error.issues).toEqual(validateDocument(doc).issues);
    expect(error.issues?.map((i) => i.code)).toEqual(['slur-endpoint-missing']);
  });

  it('rejects a schema-invalid v1 document as invalid-document', () => {
    const error = expectError(migrate({ ...valid(), masterBars: [] }));
    expect(error.code).toBe('invalid-document');
    expect(error.issues?.[0]?.code).toBe('schema.too_small');
  });

  it('never throws, also for input that is not JSON-compatible', () => {
    const cyclic: Record<string, unknown> = { format: 'musichub', schemaVersion: 1 };
    cyclic['self'] = cyclic;
    expect(() => migrate(cyclic)).not.toThrow();
    expect(expectError(migrate(cyclic)).code).toBe('migration-failed');
  });
});

// ── Synthetic chains (internal migrator, injected steps) ─────────────────────

type Doc = { format: 'musichub'; schemaVersion: number; trail: readonly number[] };
const doc = (schemaVersion: number, trail: number[] = []): Doc => ({
  format: 'musichub',
  schemaVersion,
  trail,
});
const accept = (input: unknown): ValidationResult => ({
  valid: true,
  issues: [],
  document: input as MhdDocument,
});

function chain(currentVersion: number) {
  const calls: number[] = [];
  const frozenInputs: boolean[] = [];
  const steps: Record<number, MigrationStep> = {};
  for (let from = 1; from < currentVersion; from++) {
    steps[from] = (input) => {
      calls.push(from);
      frozenInputs.push(Object.isFrozen(input) && Object.isFrozen((input as Doc).trail));
      const d = input as Doc;
      return { ...d, schemaVersion: from + 1, trail: [...d.trail, from] };
    };
  }
  return {
    calls,
    frozenInputs,
    migrator: createMigrator({ currentVersion, steps, validate: accept }),
  };
}

describe('createMigrator: synthetic chains', () => {
  it('applies 1 → 2 → 3 in ascending order, each step once', () => {
    const { calls, migrator } = chain(3);
    const result = expectOk(migrator(doc(1)));
    expect(result.fromVersion).toBe(1);
    expect(result.appliedSteps).toEqual([1, 2]);
    expect(calls).toEqual([1, 2]);
    expect(result.document).toEqual({ format: 'musichub', schemaVersion: 3, trail: [1, 2] });
  });

  it('starts at version 2 and applies only step 2', () => {
    const { calls, migrator } = chain(3);
    const result = expectOk(migrator(doc(2)));
    expect(result.appliedSteps).toEqual([2]);
    expect(calls).toEqual([2]);
  });

  it('gives steps deep-frozen input, leaves the caller input unfrozen and unchanged', () => {
    const { frozenInputs, migrator } = chain(3);
    const input = doc(1);
    const result = expectOk(migrator(input));
    expect(frozenInputs).toEqual([true, true]);
    expect(Object.isFrozen(input)).toBe(false);
    expect(input).toEqual(doc(1));
    expect(Object.isFrozen(result.document)).toBe(false);
  });

  it('fails a step that mutates its input or returns it unchanged', () => {
    const mutating = createMigrator({
      currentVersion: 2,
      steps: {
        1: (input) => {
          (input as { schemaVersion: number }).schemaVersion = 2;
          return input;
        },
      },
      validate: accept,
    });
    expect(expectError(mutating(doc(1))).code).toBe('migration-failed');
    const same = createMigrator({
      currentVersion: 2,
      steps: { 1: (input) => input },
      validate: accept,
    });
    expect(expectError(same(doc(1))).code).toBe('migration-failed');
  });

  it('fails a step that does not produce the next version', () => {
    const wrong = createMigrator({
      currentVersion: 2,
      steps: { 1: (input) => ({ ...(input as object), schemaVersion: 3 }) },
      validate: accept,
    });
    expect(expectError(wrong(doc(1))).code).toBe('migration-failed');
  });

  it('rejects an incomplete or extra step chain when the migrator is created', () => {
    const step: MigrationStep = (input) => input;
    expect(() =>
      createMigrator({ currentVersion: 3, steps: { 1: step }, validate: accept }),
    ).toThrow(/steps must be exactly 1, 2/);
    expect(() =>
      createMigrator({ currentVersion: 3, steps: { 2: step }, validate: accept }),
    ).toThrow();
    expect(() =>
      createMigrator({ currentVersion: 1, steps: { 1: step }, validate: accept }),
    ).toThrow();
    expect(() => createMigrator({ currentVersion: 0, steps: {}, validate: accept })).toThrow();
    expect(() => createMigrator({ currentVersion: 1, steps: {}, validate: accept })).not.toThrow();
  });

  it('turns a throwing step into migration-failed without internal details', () => {
    const throwing = createMigrator({
      currentVersion: 2,
      steps: {
        1: () => {
          throw new Error('secret internal failure at /Users/dev/src/migrations/v1_to_v2.ts');
        },
      },
      validate: accept,
    });
    const error = expectError(throwing(doc(1)));
    expect(error).toEqual({
      code: 'migration-failed',
      message: 'The document could not be upgraded to the current format.',
      schemaVersion: 1,
    });
    expect(JSON.stringify(error)).not.toMatch(/secret|\/Users|v1_to_v2|Error|at /);
  });

  it('returns invalid-document when the migrated document fails validation', () => {
    const { migrator: _unused } = chain(2);
    const issue = {
      code: 'duplicate-id' as const,
      path: ['id'],
      message: 'dup',
      severity: 'error' as const,
    };
    const rejecting = createMigrator({
      currentVersion: 2,
      steps: { 1: (input) => ({ ...(input as object), schemaVersion: 2 }) },
      validate: () => ({ valid: false, issues: [issue] }),
    });
    const error = expectError(rejecting(doc(1)));
    expect(error.code).toBe('invalid-document');
    expect(error.issues).toEqual([issue]);
    expect(_unused).toBeTypeOf('function');
  });
});

describe('migration registry and public API', () => {
  it('has exactly the steps 1 … MHD_SCHEMA_VERSION − 1 (none for v1) and is frozen', () => {
    const expected = Array.from({ length: MHD_SCHEMA_VERSION - 1 }, (_, i) => String(i + 1));
    expect(Object.keys(MIGRATIONS)).toEqual(expected);
    expect(Object.isFrozen(MIGRATIONS)).toBe(true);
  });

  it('exports migrate from the package root and keeps the migrator internal', () => {
    expect(root.migrate).toBe(migrate);
    expect(Object.keys(root)).not.toContain('createMigrator');
    expect(Object.keys(root)).not.toContain('MIGRATIONS');
  });

  it('uses user-safe messages for every error code', () => {
    const errors = [
      migrate(null),
      migrate({ format: 'musichub' }),
      migrate({ format: 'musichub', schemaVersion: 7 }),
      migrate({ format: 'musichub', schemaVersion: 1 }),
    ].map((r) => expectError(r));
    for (const error of errors) {
      expect(error.message).not.toMatch(/\/|\\|stack|Error|zod|step|registry|migrator/i);
    }
  });
});
