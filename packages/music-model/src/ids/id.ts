/**
 * Stable MHD ids: 12 characters of base62 (`0-9A-Za-z`), unique within a document.
 * Ids are random, never derived from a position, and stay unchanged when an element is edited
 * or moved. Import, copy and paste create new ids. alphaTab ids are never stored.
 */

export const MHD_ID_LENGTH = 12;
export const MHD_ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const MHD_ID_PATTERN = /^[0-9A-Za-z]{12}$/;

/** Fills the array with cryptographically strong random bytes (same contract as `crypto.getRandomValues`). */
export type RandomBytesSource = (bytes: Uint8Array) => Uint8Array;

// 248 = 4 × 62: bytes ≥ 248 are rejected so every alphabet character is equally likely (no modulo bias).
const UNBIASED_LIMIT = 256 - (256 % MHD_ID_ALPHABET.length);

/**
 * Creates an id generator over a random byte source. Use it to inject a platform source
 * (e.g. a React Native polyfill) or a deterministic source in tests.
 */
export function createIdGenerator(randomBytes: RandomBytesSource): () => string {
  return () => {
    let id = '';
    const buffer = new Uint8Array(MHD_ID_LENGTH * 2);
    while (id.length < MHD_ID_LENGTH) {
      randomBytes(buffer);
      for (const byte of buffer) {
        if (byte >= UNBIASED_LIMIT) continue;
        id += MHD_ID_ALPHABET.charAt(byte % MHD_ID_ALPHABET.length);
        if (id.length === MHD_ID_LENGTH) break;
      }
    }
    return id;
  };
}

type WebCrypto = { getRandomValues(bytes: Uint8Array): Uint8Array };

function webCryptoSource(): RandomBytesSource {
  const webCrypto = (globalThis as { crypto?: WebCrypto }).crypto;
  if (typeof webCrypto?.getRandomValues !== 'function') {
    throw new Error(
      'crypto.getRandomValues is not available. Provide a source with createIdGenerator() ' +
        '(React Native needs a getRandomValues polyfill).',
    );
  }
  return (bytes) => webCrypto.getRandomValues(bytes);
}

let defaultGenerator: (() => string) | undefined;

/** Generates a new MHD id with the platform Web Crypto API (`crypto.getRandomValues`). */
export function generateId(): string {
  defaultGenerator ??= createIdGenerator(webCryptoSource());
  return defaultGenerator();
}

/** True when `value` has the MHD id format. */
export function isMhdId(value: unknown): value is string {
  return typeof value === 'string' && MHD_ID_PATTERN.test(value);
}
