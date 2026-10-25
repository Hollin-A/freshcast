// Legacy API response envelope, shared by the Next.js routes and the App's
// apiFetch client. The NestJS API uses ./problem.ts instead (ADR-023).
// Success: { data, meta? }. Failure: { error: { code, message, details? } }.

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type ApiSuccess<T, M extends Record<string, unknown> = Record<string, unknown>> = {
  data: T;
  meta?: M;
};

// GET /api/sales pagination
export type PaginationMeta = {
  total: number;
  limit: number;
  offset: number;
};
