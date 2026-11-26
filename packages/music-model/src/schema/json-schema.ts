import { z } from 'zod';
import { ExtensionsJsonSchemaShape, MhdDocumentSchema } from './document.js';

/**
 * JSON Schema (draft 2020-12) of the MHD v1 document structure, generated from the Zod schema.
 *
 * It describes structure, types, enums, ranges, required keys and strict objects. It cannot
 * express refinements and cross-field rules, so it accepts some documents that
 * `validateDocument` rejects (see README.md "JSON Schema"): non-reduced or ≥ 1 positions, and
 * every invariant checked by `validateDocument`. Non-TS consumers use it as an envelope check.
 */
export function createMhdJsonSchema(): Record<string, unknown> {
  // `ExtensionsSchema` parses with a custom check (it keeps own "__proto__" keys), which JSON
  // Schema cannot express; its structure is described by `ExtensionsJsonSchemaShape` instead.
  const schema = z.toJSONSchema(MhdDocumentSchema, {
    target: 'draft-2020-12',
    unrepresentable: 'any',
  }) as { $defs?: Record<string, unknown> };
  const shape = z.toJSONSchema(ExtensionsJsonSchemaShape, { target: 'draft-2020-12' }) as {
    $defs?: Record<string, unknown>;
  };
  // The shape's root is a reference to its own `Extensions` definition; merge its definitions
  // (Extensions, JsonValue and JsonValue's recursive helper) into the document schema.
  schema.$defs = { ...schema.$defs, ...shape.$defs };
  return schema;
}
