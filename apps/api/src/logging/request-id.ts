import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";

const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Reuse a well-formed incoming request ID (e.g. from the web app or the load
 * balancer), else make one. Same rule as the web app's request-context.ts.
 */
export function resolveRequestId(incoming: string | string[] | undefined): string {
  const value = Array.isArray(incoming) ? incoming[0] : incoming;
  return value && VALID_REQUEST_ID.test(value) ? value : randomUUID();
}
