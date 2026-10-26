import { HttpResponse } from "msw";
import type { ApiErrorBody, ApiSuccess } from "@freshcast/shared";

// Legacy API envelope, built the same way as lib/api-helpers.ts. Handlers
// switch to the API's plain resources and Problem Details as each domain
// migrates (ADR-023).

export function ok<T>(
  data: T,
  init: { status?: number; meta?: Record<string, unknown> } = {},
) {
  const body: ApiSuccess<T> = init.meta ? { data, meta: init.meta } : { data };
  return HttpResponse.json(body, { status: init.status ?? 200 });
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  const body: ApiErrorBody = { error: { code, message, details } };
  return HttpResponse.json(body, { status });
}
