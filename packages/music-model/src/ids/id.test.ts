import { describe, expect, it, vi } from 'vitest';
import { MHD_ID_ALPHABET, MHD_ID_LENGTH, createIdGenerator, generateId, isMhdId } from './id.js';

describe('generateId', () => {
  it('returns 12 base62 characters', () => {
    const id = generateId();
    expect(id).toHaveLength(MHD_ID_LENGTH);
    expect(id).toMatch(/^[0-9A-Za-z]{12}$/);
    expect(isMhdId(id)).toBe(true);
  });

  it('has no collisions in 100 000 ids', () => {
    const ids = new Set(Array.from({ length: 100_000 }, () => generateId()));
    expect(ids.size).toBe(100_000);
  });

  it('uses every alphabet character and only alphabet characters', () => {
    const seen = new Set(Array.from({ length: 2000 }, () => generateId()).join(''));
    expect([...seen].sort().join('')).toBe([...MHD_ID_ALPHABET].sort().join(''));
  });

  it('uses crypto.getRandomValues, not Math.random', () => {
    const random = vi.spyOn(Math, 'random');
    const webCrypto = (
      globalThis as unknown as { crypto: { getRandomValues(bytes: Uint8Array): Uint8Array } }
    ).crypto;
    const getRandomValues = vi.spyOn(webCrypto, 'getRandomValues');
    generateId();
    expect(random).not.toHaveBeenCalled();
    expect(getRandomValues).toHaveBeenCalled();
    random.mockRestore();
    getRandomValues.mockRestore();
  });

  it('fails with a clear message when Web Crypto is missing', async () => {
    vi.resetModules();
    vi.stubGlobal('crypto', undefined);
    const fresh = await import('./id.js');
    expect(() => fresh.generateId()).toThrow(/crypto.getRandomValues is not available/);
    vi.unstubAllGlobals();
  });
});

describe('createIdGenerator (unbiased mapping)', () => {
  it('maps byte b < 248 to alphabet[b % 62]', () => {
    const bytes = [0, 61, 62, 123, 124, 185, 186, 247, 1, 2, 3, 4];
    const next = createIdGenerator((buffer) => {
      buffer.set(bytes.slice(0, buffer.length));
      return buffer;
    });
    const expected = bytes.map((byte) => MHD_ID_ALPHABET.charAt(byte % 62)).join('');
    expect(next()).toBe(expected);
  });

  it('rejects bytes 248–255 so no character is favoured (no modulo bias)', () => {
    let call = 0;
    const next = createIdGenerator((buffer) => {
      call += 1;
      // First fill: only rejected bytes. Second fill: valid bytes.
      buffer.fill(call === 1 ? 248 : 5);
      if (call === 1) buffer[3] = 255;
      return buffer;
    });
    expect(next()).toBe(MHD_ID_ALPHABET.charAt(5).repeat(12));
    expect(call).toBe(2);
  });

  it('gives each character the same number of accepted byte values', () => {
    const counts = new Map<string, number>();
    for (let byte = 0; byte < 256; byte += 1) {
      const next = createIdGenerator((buffer) => {
        buffer.fill(byte < 248 ? byte : 0);
        return buffer;
      });
      if (byte >= 248) continue;
      const char = next().charAt(0);
      counts.set(char, (counts.get(char) ?? 0) + 1);
    }
    expect(counts.size).toBe(62);
    expect(new Set(counts.values())).toEqual(new Set([4]));
  });
});

describe('isMhdId', () => {
  it.each([
    ['abcdefghijk'],
    ['abcdefghijklm'],
    ['abcdefghijk-'],
    ['abcdefghijk_'],
    [''],
    [12],
    [null],
  ])('rejects %j', (value) => {
    expect(isMhdId(value)).toBe(false);
  });

  it('accepts a 12-character base62 id', () => {
    expect(isMhdId('0aZ9bY8cX7dW')).toBe(true);
  });
});
