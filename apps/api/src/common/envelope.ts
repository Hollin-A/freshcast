/**
 * A handler result that carries `meta` (e.g. pagination) alongside `data`.
 * Return `withMeta(items, { total, limit, offset })` from a controller;
 * EnvelopeInterceptor turns it into `{ data, meta }`.
 */
export class WithMeta<T, M extends Record<string, unknown> = Record<string, unknown>> {
  constructor(
    readonly data: T,
    readonly meta: M
  ) {}
}

export function withMeta<T, M extends Record<string, unknown>>(data: T, meta: M): WithMeta<T, M> {
  return new WithMeta(data, meta);
}
