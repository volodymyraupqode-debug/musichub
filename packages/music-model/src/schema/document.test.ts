import { describe, expect, it } from 'vitest';
import { minimalDocument } from '../test-support/builders.js';
import { MhdDocumentSchema, PositionSchema } from './document.js';

type Mutable = Record<string, unknown>;

function parse(change: (doc: Mutable & ReturnType<typeof minimalDocument>) => void) {
  // A fresh document per test; invalid values are assigned on purpose below.
  const doc = minimalDocument() as Mutable & ReturnType<typeof minimalDocument>;
  change(doc);
  return MhdDocumentSchema.safeParse(doc);
}

function firstIssue(result: ReturnType<typeof parse>) {
  return result.success ? undefined : result.error.issues[0];
}

describe('MhdDocumentSchema', () => {
  it('accepts a minimal document', () => {
    expect(MhdDocumentSchema.safeParse(minimalDocument()).success).toBe(true);
  });

  it.each(['format', 'schemaVersion', 'id', 'meta', 'masterBars', 'tracks'])(
    'requires %s',
    (key) => {
      const result = parse((doc) => {
        Reflect.deleteProperty(doc, key);
      });
      const issue = firstIssue(result);
      expect(issue?.path).toEqual([key]);
      // A missing literal field (format, schemaVersion) is reported as invalid_value by Zod 4.
      expect(['invalid_type', 'invalid_value']).toContain(issue?.code);
    },
  );

  it('rejects wrong types', () => {
    expect(firstIssue(parse((doc) => (doc.meta = { title: 42 } as never)))).toMatchObject({
      code: 'invalid_type',
      path: ['meta', 'title'],
    });
  });

  it('rejects a wrong format and schema version', () => {
    expect(firstIssue(parse((doc) => (doc.format = 'alphatab' as never)))).toMatchObject({
      path: ['format'],
    });
    expect(firstIssue(parse((doc) => (doc.schemaVersion = 0 as never)))).toMatchObject({
      path: ['schemaVersion'],
    });
  });

  describe('strict objects at every level', () => {
    it.each([
      ['document', (doc: Mutable) => (doc.extra = 1), []],
      [
        'meta',
        (doc: Mutable & ReturnType<typeof minimalDocument>) =>
          Object.assign(doc.meta, { extra: 1 }),
        ['meta'],
      ],
      [
        'master bar',
        (doc: Mutable & ReturnType<typeof minimalDocument>) =>
          Object.assign(doc.masterBars[0] ?? {}, { extra: 1 }),
        ['masterBars', 0],
      ],
      [
        'track instrument',
        (doc: Mutable & ReturnType<typeof minimalDocument>) =>
          Object.assign(doc.tracks[0]?.instrument ?? {}, { extra: 1 }),
        ['tracks', 0, 'instrument'],
      ],
      [
        'note effects',
        (doc: Mutable & ReturnType<typeof minimalDocument>) => {
          const target = doc.tracks[0]?.staves[0]?.bars[0]?.voices[0]?.beats[0]?.notes[0];
          if (target) target.effects = { palmMute: true, extra: 1 } as never;
        },
        ['tracks', 0, 'staves', 0, 'bars', 0, 'voices', 0, 'beats', 0, 'notes', 0, 'effects'],
      ],
    ] as const)('rejects unknown keys in the %s', (_name, change, path) => {
      expect(
        firstIssue(parse(change as (doc: Mutable & ReturnType<typeof minimalDocument>) => void)),
      ).toMatchObject({
        code: 'unrecognized_keys',
        keys: ['extra'],
        path,
      });
    });

    it('does not strip unknown keys silently', () => {
      const doc = { ...minimalDocument(), extra: true };
      expect(MhdDocumentSchema.safeParse(doc).success).toBe(false);
    });
  });

  it('rejects invalid enums', () => {
    const result = parse((doc) => {
      const staffTrack = doc.tracks[0];
      if (staffTrack) (staffTrack.instrument as Mutable).family = 'kazoo';
    });
    expect(firstIssue(result)).toMatchObject({
      code: 'invalid_value',
      path: ['tracks', 0, 'instrument', 'family'],
    });
  });

  it.each([
    [
      'midiProgram 128',
      (doc: ReturnType<typeof minimalDocument>) =>
        ((doc.tracks[0] as never as { instrument: Mutable }).instrument.midiProgram = 128),
    ],
    [
      'volume 1.01',
      (doc: ReturnType<typeof minimalDocument>) =>
        ((doc.tracks[0] as never as { mixer: Mutable }).mixer.volume = 1.01),
    ],
    [
      'pan -1.01',
      (doc: ReturnType<typeof minimalDocument>) =>
        ((doc.tracks[0] as never as { mixer: Mutable }).mixer.pan = -1.01),
    ],
    [
      'bpm 19',
      (doc: ReturnType<typeof minimalDocument>) =>
        ((doc.masterBars[0]?.tempoChanges?.[0] as Mutable).bpm = 19),
    ],
    [
      'bpm 401',
      (doc: ReturnType<typeof minimalDocument>) =>
        ((doc.masterBars[0]?.tempoChanges?.[0] as Mutable).bpm = 401),
    ],
    [
      'fifths 8',
      (doc: ReturnType<typeof minimalDocument>) =>
        ((doc.masterBars[0]?.keySignature as Mutable).fifths = 8),
    ],
    [
      'title of 201 chars',
      (doc: ReturnType<typeof minimalDocument>) => ((doc.meta as Mutable).title = 'x'.repeat(201)),
    ],
    [
      'empty title',
      (doc: ReturnType<typeof minimalDocument>) => ((doc.meta as Mutable).title = ''),
    ],
    [
      'repeat count 1',
      (doc: ReturnType<typeof minimalDocument>) =>
        Object.assign(doc.masterBars[0] ?? {}, { repeatEnd: { count: 1 } }),
    ],
    [
      'alternate ending 0',
      (doc: ReturnType<typeof minimalDocument>) =>
        Object.assign(doc.masterBars[0] ?? {}, { alternateEndings: [0] }),
    ],
    [
      'tuplet actual 1',
      (doc: ReturnType<typeof minimalDocument>) => {
        const target = doc.tracks[0]?.staves[0]?.bars[0]?.voices[0]?.beats[0];
        if (target) target.duration = { value: 1, dots: 0, tuplet: { actual: 1, normal: 1 } };
      },
    ],
    [
      'tuplet normal 16',
      (doc: ReturnType<typeof minimalDocument>) => {
        const target = doc.tracks[0]?.staves[0]?.bars[0]?.voices[0]?.beats[0];
        if (target) target.duration = { value: 1, dots: 0, tuplet: { actual: 3, normal: 16 } };
      },
    ],
    [
      'velocity 0',
      (doc: ReturnType<typeof minimalDocument>) => {
        const target = doc.tracks[0]?.staves[0]?.bars[0]?.voices[0]?.beats[0]?.notes[0];
        if (target) target.velocity = 0;
      },
    ],
    [
      'duration value 3',
      (doc: ReturnType<typeof minimalDocument>) => {
        const target = doc.tracks[0]?.staves[0]?.bars[0]?.voices[0]?.beats[0];
        if (target) (target.duration as Mutable).value = 3;
      },
    ],
    [
      '3 strings',
      (doc: ReturnType<typeof minimalDocument>) => {
        const stringed = doc.tracks[0]?.staves[0]?.stringed;
        if (stringed) stringed.tuning = [64, 59, 55];
      },
    ],
    [
      '11 strings',
      (doc: ReturnType<typeof minimalDocument>) => {
        const stringed = doc.tracks[0]?.staves[0]?.stringed;
        if (stringed) stringed.tuning = Array.from({ length: 11 }, () => 40);
      },
    ],
    [
      'tuning pitch 128',
      (doc: ReturnType<typeof minimalDocument>) => {
        const stringed = doc.tracks[0]?.staves[0]?.stringed;
        if (stringed) stringed.tuning = [128, 59, 55, 50, 45, 40];
      },
    ],
  ])('rejects out-of-range value: %s', (_name, change) => {
    expect(
      parse(change as (doc: Mutable & ReturnType<typeof minimalDocument>) => void).success,
    ).toBe(false);
  });

  it.each([
    [
      'midiProgram 0 and 127',
      (doc: ReturnType<typeof minimalDocument>) =>
        ((doc.tracks[0] as never as { instrument: Mutable }).instrument.midiProgram = 127),
    ],
    [
      'bpm 20',
      (doc: ReturnType<typeof minimalDocument>) =>
        ((doc.masterBars[0]?.tempoChanges?.[0] as Mutable).bpm = 20),
    ],
    [
      'bpm 400',
      (doc: ReturnType<typeof minimalDocument>) =>
        ((doc.masterBars[0]?.tempoChanges?.[0] as Mutable).bpm = 400),
    ],
    [
      'title of 200 chars',
      (doc: ReturnType<typeof minimalDocument>) => ((doc.meta as Mutable).title = 'x'.repeat(200)),
    ],
    [
      'volume 0 and pan 1',
      (doc: ReturnType<typeof minimalDocument>) =>
        Object.assign((doc.tracks[0] as never as { mixer: Mutable }).mixer, { volume: 0, pan: 1 }),
    ],
  ])('accepts boundary value: %s', (_name, change) => {
    expect(
      parse(change as (doc: Mutable & ReturnType<typeof minimalDocument>) => void).success,
    ).toBe(true);
  });

  it('rejects empty masterBars, tracks, staves and voices arrays', () => {
    expect(parse((doc) => (doc.masterBars = [])).success).toBe(false);
    expect(parse((doc) => (doc.tracks = [])).success).toBe(false);
    expect(parse((doc) => doc.tracks[0] && (doc.tracks[0].staves = [])).success).toBe(false);
    expect(
      parse((doc) => {
        const target = doc.tracks[0]?.staves[0]?.bars[0];
        if (target) target.voices = [];
      }).success,
    ).toBe(false);
  });

  it('rejects more than four voices', () => {
    const result = parse((doc) => {
      const target = doc.tracks[0]?.staves[0]?.bars[0];
      const voice = target?.voices[0];
      if (target && voice) target.voices = [voice, voice, voice, voice, voice];
    });
    expect(firstIssue(result)).toMatchObject({ code: 'too_big' });
  });

  it('rejects a malformed id', () => {
    expect(firstIssue(parse((doc) => (doc.id = 'not-an-id')))).toMatchObject({ path: ['id'] });
  });

  it('has no chordId on beats (chord diagrams are deferred)', () => {
    const result = parse((doc) => {
      const target = doc.tracks[0]?.staves[0]?.bars[0]?.voices[0]?.beats[0];
      if (target) (target as Mutable).chordId = 'abcdefghijkl';
    });
    expect(firstIssue(result)).toMatchObject({ code: 'unrecognized_keys', keys: ['chordId'] });
  });

  describe('extensions', () => {
    it('accepts namespaced JSON values', () => {
      const result = parse((doc) => {
        doc.extensions = {
          'alphatab.unmapped': { T00000000001: [1, 'a', null, true, { x: 1.5 }] },
          'acme.flag': false,
        };
      });
      expect(result.success).toBe(true);
    });

    it.each(['unmapped', 'Alphatab.x', '.x', 'a.', 'a b.c'])('rejects key %j', (key) => {
      expect(parse((doc) => (doc.extensions = { [key]: 1 })).success).toBe(false);
    });

    it('rejects values that are not JSON', () => {
      expect(parse((doc) => (doc.extensions = { 'acme.x': Number.NaN })).success).toBe(false);
      expect(parse((doc) => (doc.extensions = { 'acme.x': undefined as never })).success).toBe(
        false,
      );
    });

    it('does not apply MHD strictness inside extension values', () => {
      expect(
        parse((doc) => (doc.extensions = { 'acme.x': { anything: { goes: [1] } } })).success,
      ).toBe(true);
    });
  });
});

describe('PositionSchema', () => {
  it.each([[[0, 1]], [[1, 2]], [[3, 4]], [[1, 3]]])('accepts %j', (value) => {
    expect(PositionSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    [[1, 1], 'Position must be in [0, 1)'],
    [[5, 4], 'Position must be in [0, 1)'],
    [[2, 4], 'Position must be a reduced fraction (zero is [0, 1])'],
    [[0, 4], 'Position must be a reduced fraction (zero is [0, 1])'],
  ])('rejects %j', (value, message) => {
    const result = PositionSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(message);
  });

  it.each([[[1, 0]], [[-1, 2]], [[0.5, 1]], [[1, 2, 3]]])('rejects malformed %j', (value) => {
    expect(PositionSchema.safeParse(value).success).toBe(false);
  });
});
