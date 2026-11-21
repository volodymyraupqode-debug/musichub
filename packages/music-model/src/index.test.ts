import { describe, expect, it } from 'vitest';
import { MHD_FORMAT, MHD_SCHEMA_VERSION } from './index.js';

describe('music-model format identity', () => {
  it('exposes the MHD format name and schema version', () => {
    expect(MHD_FORMAT).toBe('musichub');
    expect(MHD_SCHEMA_VERSION).toBe(1);
  });
});
