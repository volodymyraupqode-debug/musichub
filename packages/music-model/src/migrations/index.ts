// Public MHD migration entry point (MUSIC_ENGINE.md §3.4, ADR-0002 Amendment 11).
import { MHD_SCHEMA_VERSION } from '../constants.js';
import { validateDocument } from '../validate/validate-document.js';
import { createMigrator, type MigrationResult } from './migrator.js';
import { MIGRATIONS } from './registry.js';

export type { MigrationError, MigrationErrorCode, MigrationResult } from './migrator.js';

const run = createMigrator({
  currentVersion: MHD_SCHEMA_VERSION,
  steps: MIGRATIONS,
  validate: validateDocument,
});

/**
 * Brings a document of any supported schema version to the current version and validates it.
 * Never throws for JSON-compatible input and never mutates it. A current-version document runs no
 * step and is returned as a validated deep-equal copy. Newer versions are rejected, never
 * downgraded. Validation errors reject the document; warnings are returned with it.
 */
export function migrate(input: unknown): MigrationResult {
  return run(input);
}
