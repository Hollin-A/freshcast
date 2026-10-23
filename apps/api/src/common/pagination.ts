import type { Page, PageMeta } from "@freshcast/shared";

/**
 * A paginated list response, `{ items, meta: { total, limit, offset } }`
 * (ADR-023). Single resources are returned as-is.
 */
export function paginated<T>(items: T[], meta: PageMeta): Page<T> {
  return { items, meta };
}
