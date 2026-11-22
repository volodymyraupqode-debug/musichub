// S2-00 scenario B: temporary failing test (ci/verify-red-checks-2, never merged).
import { describe, expect, it } from 'vitest';

describe('S2-00 CI probe', () => {
  it('fails on purpose to prove CI turns red on a failing test', () => {
    expect(1).toBe(2);
  });
});
