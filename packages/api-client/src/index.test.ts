import { describe, expect, it } from 'vitest';
import { createApiClient } from './index.js';

describe('createApiClient', () => {
  it('calls the versioned health endpoint and returns typed data', async () => {
    const requested: string[] = [];
    const fetchStub: typeof fetch = async (input) => {
      requested.push(input instanceof Request ? input.url : String(input));
      return new Response(
        JSON.stringify({ status: 'ok', version: 'test', checks: { database: 'ok', redis: 'ok' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const client = createApiClient('http://api.test/', { fetch: fetchStub });
    const { data, error } = await client.GET('/health');

    expect(requested).toEqual(['http://api.test/api/v1/health']);
    expect(error).toBeUndefined();
    expect(data?.status).toBe('ok');
  });

  it('exposes 503 health bodies as errors', async () => {
    const fetchStub: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          status: 'fail',
          version: 'test',
          checks: { database: 'fail', redis: 'ok' },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );

    const { data, error, response } = await createApiClient('http://api.test', {
      fetch: fetchStub,
    }).GET('/health');

    expect(response.status).toBe(503);
    expect(data).toBeUndefined();
    expect(error?.checks.database).toBe('fail');
  });
});
