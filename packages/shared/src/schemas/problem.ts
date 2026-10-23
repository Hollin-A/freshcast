import { z } from "zod";

// The NestJS API's response conventions (ADR-023). The Legacy API keeps the
// { data } / { error } envelope in ./api.ts until Stage 5.

// Problem type URIs identify the problem; they don't need to resolve.
export const PROBLEM_TYPE_BASE = "https://api.freshcast.site/problems/";

// RFC 9457 Problem Details, sent as application/problem+json. `code` is a
// short extension clients can switch on; `errors` holds field messages for
// VALIDATION_ERROR.
export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  code: z.string(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

export const pageMetaSchema = z.object({
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});

// A paginated list: { items, meta }. Single resources are sent unwrapped.
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), meta: pageMetaSchema });
}

export type PageMeta = z.infer<typeof pageMetaSchema>;

export type Page<T> = { items: T[]; meta: PageMeta };
