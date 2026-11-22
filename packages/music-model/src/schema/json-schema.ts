import { z } from 'zod';
import { MhdDocumentSchema } from './document.js';

/**
 * JSON Schema (draft 2020-12) of the MHD v1 document structure, generated from the Zod schema.
 *
 * It describes structure, types, enums, ranges, required keys and strict objects. It cannot
 * express refinements and cross-field rules, so it accepts some documents that
 * `validateDocument` rejects (see README.md "JSON Schema"): non-reduced or ≥ 1 positions, and
 * every invariant checked by `validateDocument`. Non-TS consumers use it as an envelope check.
 */
export function createMhdJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(MhdDocumentSchema, { target: 'draft-2020-12' });
}
