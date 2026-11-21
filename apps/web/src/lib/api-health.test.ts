import { createApiClient } from '@musichub/api-client';
import { describe, expect, it } from 'vitest';
import { getApiHealth, resolveApiOrigin } from './api-health';

const respond =
  (status: number, body: unknown): typeof fetch =>
  async () =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const checks = { database: 'ok', redis: 'ok' } as const;

describe('getApiHealth', () => {
  it('returns ok for a healthy API', async () => {
    const client = createApiClient('http://api.test', {
      fetch: respond(200, { status: 'ok', version: '1', checks }),
    });
    await expect(getApiHealth(client)).resolves.toBe('ok');
  });

  it('returns unavailable when a dependency check fails (503)', async () => {
    const client = createApiClient('http://api.test', {
      fetch: respond(503, { status: 'fail', version: '1', checks: { ...checks, redis: 'fail' } }),
    });
    await expect(getApiHealth(client)).resolves.toBe('unavailable');
  });

  it('returns unavailable when the API cannot be reached', async () => {
    const client = createApiClient('http://api.test', {
      fetch: async () => {
        throw new TypeError('fetch failed');
      },
    });
    await expect(getApiHealth(client)).resolves.toBe('unavailable');
  });
});

describe('resolveApiOrigin', () => {
  it('prefers the server-only override, then the public URL', () => {
    expect(
      resolveApiOrigin({ API_INTERNAL_URL: 'http://api:8000', NEXT_PUBLIC_API_URL: 'http://x' }),
    ).toBe('http://api:8000');
    expect(resolveApiOrigin({ NEXT_PUBLIC_API_URL: 'http://public:8000' })).toBe(
      'http://public:8000',
    );
    expect(resolveApiOrigin({})).toBe('http://localhost:8000');
  });
});
