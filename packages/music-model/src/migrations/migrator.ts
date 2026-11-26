// Internal generic migrator (MUSIC_ENGINE.md §3.4, ADR-0002 Amendment 11). Not part of the public
// package API: `migrate()` in ./index.ts is built from it with the real registry, and tests build
// migrators with synthetic steps. Pure: it never mutates its input.
import { MHD_FORMAT } from '../constants.js';
import type { MhdDocument } from '../schema/document.js';
import type { ValidationIssue } from '../validate/issues.js';
import type { ValidationResult } from '../validate/validate-document.js';

export type MigrationErrorCode =
  | 'not-an-mhd-document'
  | 'invalid-schema-version'
  | 'unsupported-schema-version'
  | 'invalid-document'
  | 'migration-failed';

export type MigrationError = {
  code: MigrationErrorCode;
  /** User-safe text: no stack traces, file paths, step names or internal exception messages. */
  message: string;
  schemaVersion?: number;
  /** Validator issues, only for `invalid-document`. */
  issues?: ValidationIssue[];
};

export type MigrationResult =
  | {
      ok: true;
      document: MhdDocument;
      fromVersion: number;
      /** Source versions of the steps applied, ascending (step N migrates vN to vN+1). */
      appliedSteps: readonly number[];
      /** Warnings of the final validation (no errors). */
      issues: ValidationIssue[];
    }
  | { ok: false; error: MigrationError };

/**
 * One step from version N to N + 1. It receives a deep-frozen document of version N and must
 * return a new object of version N + 1 (`schemaVersion: N + 1`). Real steps live in
 * `migrations/vN_to_vN+1.ts`.
 */
export type MigrationStep = (document: unknown) => unknown;

/** Steps keyed by source version N. */
export type MigrationSteps = Readonly<Record<number, MigrationStep>>;

export type MigratorConfig = {
  currentVersion: number;
  steps: MigrationSteps;
  validate: (input: unknown) => ValidationResult;
};

const MESSAGES: Record<MigrationErrorCode, string> = {
  'not-an-mhd-document': 'This file is not a MusicHub document.',
  'invalid-schema-version': 'The document has no valid schema version.',
  'unsupported-schema-version':
    'This document was created by a newer version of MusicHub. Update MusicHub to open it.',
  'invalid-document': 'The document is not a valid MusicHub document.',
  'migration-failed': 'The document could not be upgraded to the current format.',
};

function failure(
  code: MigrationErrorCode,
  extra: Omit<MigrationError, 'code' | 'message'> = {},
): MigrationResult {
  return { ok: false, error: { code, message: MESSAGES[code], ...extra } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Deep copy of JSON-compatible data (plain objects, arrays, primitives). */
function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item: unknown) => clone(item)) as T;
  if (isRecord(value)) {
    // Object.fromEntries defines own properties, so keys such as "__proto__" stay data.
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) as T;
  }
  return value;
}

/** Deep-freezes a value it owns (never the caller's input). */
function freeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}

/**
 * Builds a migrator. Throws only here, at creation, when the step chain is not exactly
 * 1 … currentVersion − 1 (a programming error, never a document error).
 */
export function createMigrator(config: MigratorConfig): (input: unknown) => MigrationResult {
  const { currentVersion, steps, validate } = config;
  if (!Number.isInteger(currentVersion) || currentVersion < 1) {
    throw new Error('Migrator: the current schema version must be a positive integer');
  }
  const expected = Array.from({ length: currentVersion - 1 }, (_, i) => String(i + 1));
  const actual = Object.keys(steps).sort((a, b) => Number(a) - Number(b));
  if (expected.length !== actual.length || expected.some((key, i) => key !== actual[i])) {
    throw new Error(
      `Migrator: steps must be exactly ${expected.join(', ') || 'none'}; got ${actual.join(', ') || 'none'}`,
    );
  }

  return (input: unknown): MigrationResult => {
    try {
      if (!isRecord(input) || input['format'] !== MHD_FORMAT) return failure('not-an-mhd-document');
      const version = input['schemaVersion'];
      if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
        return failure('invalid-schema-version');
      }
      if (version > currentVersion) {
        return failure('unsupported-schema-version', { schemaVersion: version });
      }

      let document: unknown = freeze(clone(input));
      const appliedSteps: number[] = [];
      for (let from = version; from < currentVersion; from++) {
        const step = steps[from];
        let next: unknown;
        try {
          if (!step) return failure('migration-failed', { schemaVersion: version });
          next = step(document);
        } catch {
          return failure('migration-failed', { schemaVersion: version });
        }
        if (!isRecord(next) || next === document || next['schemaVersion'] !== from + 1) {
          return failure('migration-failed', { schemaVersion: version });
        }
        appliedSteps.push(from);
        document = freeze(clone(next));
      }

      const result = validate(document);
      if (!result.valid || result.document === undefined) {
        return failure('invalid-document', { schemaVersion: version, issues: result.issues });
      }
      return {
        ok: true,
        document: clone(result.document),
        fromVersion: version,
        appliedSteps,
        issues: result.issues,
      };
    } catch {
      return failure('migration-failed');
    }
  };
}
