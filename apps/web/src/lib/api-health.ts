import { createApiClient, type ApiClient } from '@musichub/api-client';

export type ApiHealthStatus = 'ok' | 'unavailable';

const DEFAULT_API_ORIGIN = 'http://localhost:8000';
const HEALTH_TIMEOUT_MS = 2000;

type ApiEnv = Pick<NodeJS.ProcessEnv, 'API_INTERNAL_URL' | 'NEXT_PUBLIC_API_URL'>;

/** API origin for server-side requests: server-only override first, then the public URL. */
export function resolveApiOrigin(env: ApiEnv = process.env): string {
  return env.API_INTERNAL_URL ?? env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_ORIGIN;
}

/**
 * Returns `ok` only when the API answers 200 with `status: 'ok'`.
 * Network errors, timeouts and failed dependency checks (503) count as `unavailable`.
 */
export async function getApiHealth(
  client: ApiClient = createApiClient(resolveApiOrigin()),
): Promise<ApiHealthStatus> {
  try {
    const { data } = await client.GET('/health', {
      cache: 'no-store',
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return data?.status === 'ok' ? 'ok' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}
