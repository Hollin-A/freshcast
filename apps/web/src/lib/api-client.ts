import type { ApiErrorBody, ApiSuccess } from "@freshcast/shared";

/** Thrown for non-2xx API responses; carries the envelope's error fields. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

type ApiFetchOptions = {
  /** Message to use when the response carries no error message. */
  fallbackMessage?: string;
};

async function request<T, M extends Record<string, unknown>>(
  url: string,
  init: RequestInit | undefined,
  options: ApiFetchOptions
): Promise<ApiSuccess<T, M>> {
  const res = await fetch(url, init);
  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new ApiRequestError(
      error?.message || options.fallbackMessage || `Request failed (${res.status})`,
      res.status,
      error?.code,
      error?.details
    );
  }

  return body as ApiSuccess<T, M>;
}

/** Calls a JSON API route and returns the envelope's `data`. */
export async function apiFetch<T>(
  url: string,
  init?: RequestInit,
  options: ApiFetchOptions = {}
): Promise<T> {
  return (await request<T, Record<string, unknown>>(url, init, options)).data;
}

/** Like `apiFetch`, but also returns the envelope's `meta` (e.g. pagination). */
export async function apiFetchWithMeta<T, M extends Record<string, unknown>>(
  url: string,
  init?: RequestInit,
  options: ApiFetchOptions = {}
): Promise<{ data: T; meta: M }> {
  const body = await request<T, M>(url, init, options);
  return { data: body.data, meta: body.meta as M };
}
