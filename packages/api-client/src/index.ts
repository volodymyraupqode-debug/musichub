/**
 * @musichub/api-client — typed client for the MusicHub API.
 *
 * Types are generated from `openapi/openapi.yaml` (`pnpm codegen`) into
 * `src/generated/`; never edit generated files by hand.
 */
import createClient, { type ClientOptions } from 'openapi-fetch';
import type { components, paths } from './generated/schema.js';

export type { components, paths };
export type Health = components['schemas']['Health'];
export type ProblemDetails = components['schemas']['ProblemDetails'];

/** API base path appended to the server origin. */
export const API_BASE_PATH = '/api/v1';

/**
 * Creates a typed API client.
 * @param origin Server origin, e.g. `http://localhost:8000` (no trailing `/api/v1`).
 */
export function createApiClient(origin: string, options: Omit<ClientOptions, 'baseUrl'> = {}) {
  return createClient<paths>({
    ...options,
    baseUrl: `${origin.replace(/\/+$/, '')}${API_BASE_PATH}`,
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;
