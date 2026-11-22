import { describe, expect, it } from 'vitest';
import { minimalDocument } from '../test-support/builders.js';
import { validateDocument } from '../validate/validate-document.js';
import { createMhdJsonSchema } from './json-schema.js';

type JsonSchemaNode = {
  type?: string;
  properties?: Record<string, JsonSchemaNode>;
  additionalProperties?: boolean | JsonSchemaNode;
  required?: string[];
  $ref?: string;
  [key: string]: unknown;
};

const schema = createMhdJsonSchema() as {
  $schema: string;
  $ref: string;
  $defs: Record<string, JsonSchemaNode>;
};

/** Every object schema in the tree (definitions and nested inline objects). */
function objectSchemas(node: unknown, found: JsonSchemaNode[] = []): JsonSchemaNode[] {
  if (Array.isArray(node)) {
    for (const item of node) objectSchemas(item, found);
  } else if (typeof node === 'object' && node !== null) {
    const typed = node as JsonSchemaNode;
    if (typed.type === 'object') found.push(typed);
    for (const child of Object.values(typed)) objectSchemas(child, found);
  }
  return found;
}

describe('createMhdJsonSchema', () => {
  it('generates a draft 2020-12 schema rooted at MhdDocument', () => {
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$ref).toBe('#/$defs/MhdDocument');
    const root = schema.$defs.MhdDocument;
    expect(root?.required).toEqual([
      'format',
      'schemaVersion',
      'id',
      'meta',
      'masterBars',
      'tracks',
    ]);
    expect(root?.properties?.format).toMatchObject({ const: 'musichub' });
    expect(root?.properties?.schemaVersion).toMatchObject({ const: 1 });
  });

  it('describes the nested entities', () => {
    for (const name of [
      'Meta',
      'MasterBar',
      'Track',
      'Staff',
      'Bar',
      'Voice',
      'Beat',
      'Note',
      'Duration',
      'Position',
      'MhdId',
    ]) {
      expect(schema.$defs[name], name).toBeDefined();
    }
    expect(schema.$defs.Note?.properties?.pitch).toMatchObject({
      type: 'integer',
      minimum: 0,
      maximum: 127,
    });
    expect(schema.$defs.MhdId).toMatchObject({ type: 'string', pattern: '^[0-9A-Za-z]{12}$' });
  });

  it('is strict for every MHD object and open only for extension values', () => {
    const objects = objectSchemas(schema.$defs);
    const mhdObjects = objects.filter((object) => object.properties !== undefined);
    expect(mhdObjects.length).toBeGreaterThan(20);
    for (const object of mhdObjects) expect(object.additionalProperties).toBe(false);

    const extensions = schema.$defs.Extensions;
    expect(extensions?.propertyNames).toMatchObject({
      pattern: expect.stringContaining('\\.') as unknown,
    });
    expect(extensions?.additionalProperties).toEqual({ $ref: '#/$defs/JsonValue' });
  });

  it('only references definitions that exist', () => {
    const refs = JSON.stringify(schema).match(/"#\/\$defs\/[^"]+"/g) ?? [];
    for (const ref of refs) {
      const name = ref.slice('"#/$defs/'.length, -1);
      expect(schema.$defs[name], name).toBeDefined();
    }
  });

  it('is deterministic and matches the committed file', async () => {
    const first = JSON.stringify(createMhdJsonSchema(), null, 2);
    expect(JSON.stringify(createMhdJsonSchema(), null, 2)).toBe(first);
    await expect(`${first}\n`).toMatchFileSnapshot('../../json-schema/mhd-v1.schema.json');
  });

  it('documents its limits: refinements and invariants are not in the JSON Schema', () => {
    // A non-reduced position is structurally valid JSON Schema-wise (two integers, denominator ≥ 1) …
    const position = schema.$defs.Position;
    expect(position).toMatchObject({ type: 'array', minItems: 2, maxItems: 2 });
    expect(JSON.stringify(position)).not.toMatch(/reduced|\[0, 1\)/);
    // … but the runtime rejects it. Cross-field invariants are runtime-only as well.
    const doc = minimalDocument();
    const first = doc.masterBars[0];
    if (first) first.tempoChanges = [{ position: [0, 2], bpm: 120 }];
    expect(validateDocument(doc).issues).toContainEqual(
      expect.objectContaining({
        code: 'schema.custom',
        path: ['masterBars', 0, 'tempoChanges', 0, 'position'],
      }),
    );
  });
});
