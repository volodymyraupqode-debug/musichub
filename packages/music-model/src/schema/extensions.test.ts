// `extensions` are preserved verbatim (MUSIC_ENGINE.md §3.4), including own "__proto__" keys at
// every depth, while the existing rules for keys and JSON values stay in force.
import { describe, expect, it } from 'vitest';
import guitar from '../../fixtures/v1/guitar-basic.mhd.json' with { type: 'json' };
import { migrate } from '../migrations/index.js';
import { deepFreeze } from '../test-support/builders.js';
import { validateDocument } from '../validate/validate-document.js';
import type { MhdDocument } from './document.js';

const withExtensions = (extensions: unknown): unknown => ({
  ...(JSON.parse(JSON.stringify(guitar)) as MhdDocument),
  extensions,
});
const issuesOf = (extensions: unknown) =>
  validateDocument(withExtensions(extensions)).issues.map((i) => [i.code, i.path]);

/** Every object in a JSON value has the ordinary prototype and only own data keys. */
function expectOrdinaryObjects(value: unknown): void {
  if (Array.isArray(value)) {
    expect(Object.getPrototypeOf(value)).toBe(Array.prototype);
    value.forEach(expectOrdinaryObjects);
  } else if (typeof value === 'object' && value !== null) {
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    for (const key of Object.keys(value)) {
      expect(Object.getOwnPropertyDescriptor(value, key)).toHaveProperty('value');
      expectOrdinaryObjects((value as Record<string, unknown>)[key]);
    }
  }
}

/** Pairs of objects at the same place in both values that are the same reference. */
function sharedObjects(a: unknown, b: unknown): number {
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return 0;
  return (
    (a === b ? 1 : 0) +
    Object.keys(a).reduce(
      (n, key) =>
        n + sharedObjects((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
      0,
    )
  );
}

const TRICKY_JSON = `{
  "vendor.keys": {
    "__proto__": { "kept": true, "__proto__": { "deeper": [1, { "__proto__": null }] } },
    "constructor": { "prototype": 1, "__proto__": "text" },
    "list": [{ "__proto__": [true, false] }, [], [[{ "__proto__": {} }]], "s", 2.5, -3, 0, null],
    "toString": "not a function",
    "hasOwnProperty": false
  },
  "alphatab.unmapped": { "GA0000000001": { "nested": [1, "two", null, { "deep": true }] } },
  "vendor.empty": {}
}`;

describe('extensions: verbatim preservation', () => {
  it.each([
    ['validateDocument', (input: unknown) => validateDocument(input).document?.extensions],
    [
      'migrate',
      (input: unknown) => {
        const result = migrate(input);
        return result.ok ? result.document.extensions : undefined;
      },
    ],
  ])('%s keeps own "__proto__" keys at every depth as data', (_, run) => {
    const extensions = JSON.parse(TRICKY_JSON) as Record<string, unknown>;
    const input = deepFreeze(withExtensions(extensions) as MhdDocument);
    const output = run(input);
    expect(JSON.stringify(output)).toBe(JSON.stringify(extensions));
    const keys = output?.['vendor.keys'] as Record<string, unknown>;
    expect(Object.keys(keys)).toEqual([
      '__proto__',
      'constructor',
      'list',
      'toString',
      'hasOwnProperty',
    ]);
    expect(Object.keys(keys['__proto__'] as object)).toEqual(['kept', '__proto__']);
    expectOrdinaryObjects(output);
    // Independent copy: no object of the result is an object of the input.
    expect(sharedObjects(output, input.extensions)).toBe(0);
    // Nothing reached Object.prototype.
    expect(({} as Record<string, unknown>)['kept']).toBeUndefined();
    expect(({} as Record<string, unknown>)['deeper']).toBeUndefined();
  });

  it('accepts objects without a prototype as JSON objects', () => {
    const bare = Object.assign(Object.create(null) as Record<string, unknown>, { a: 1 });
    const result = validateDocument(withExtensions({ 'vendor.bare': bare }));
    expect(result.valid).toBe(true);
    expect(result.document?.extensions).toEqual({ 'vendor.bare': { a: 1 } });
  });
});

describe('extensions: validation rules are unchanged', () => {
  it('rejects keys that are not vendor.name, including a top-level "__proto__"', () => {
    expect(issuesOf({ BadKey: 1 })).toEqual([['schema.invalid_key', ['extensions', 'BadKey']]]);
    // Before, z.record dropped this key silently; the key rule now applies to it as well.
    expect(issuesOf(JSON.parse('{"__proto__": 1, "vendor.ok": 2}'))).toEqual([
      ['schema.invalid_key', ['extensions', '__proto__']],
    ]);
  });

  it.each([
    ['undefined', { x: undefined }],
    ['a function', [1, () => 1]],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a Date', new Date(0)],
    ['a Map', new Map()],
    [
      'a class instance',
      new (class Thing {
        readonly kind = 'thing';
      })(),
    ],
    ['a sparse array', [1, , 3]], // eslint-disable-line no-sparse-arrays
    ['a symbol', Symbol('s')],
    ['a bigint', 1n],
  ])('rejects %s as an extension value', (_, value) => {
    expect(issuesOf({ 'vendor.a': value })).toEqual([
      ['schema.invalid_union', ['extensions', 'vendor.a']],
    ]);
  });

  it('rejects a cyclic value', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(issuesOf({ 'vendor.a': cyclic })).toEqual([
      ['schema.invalid_union', ['extensions', 'vendor.a']],
    ]);
  });

  it.each([
    ['a string', 'str', 'string'],
    ['an array', [], 'array'],
    ['null', null, 'null'],
  ])('rejects %s as the extensions object', (_, value, received) => {
    const issues = validateDocument(withExtensions(value)).issues;
    expect(issues).toEqual([
      expect.objectContaining({
        code: 'schema.invalid_type',
        path: ['extensions'],
        message: `Invalid input: expected record, received ${received}`,
      }),
    ]);
  });
});
