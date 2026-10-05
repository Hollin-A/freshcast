import { AsyncLocalStorage } from "node:async_hooks";

export const REQUEST_ID_HEADER = "x-request-id";

type RequestContext = { requestId: string };

// Holds the current request's ID for everything that runs while handling it,
// so the logger can tag lines without the ID being passed through every call.
const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

/** Reuse a well-formed incoming request ID (e.g. from a load balancer), else make one. */
export function resolveRequestId(incoming: string | null | undefined): string {
  return incoming && VALID_REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
}
