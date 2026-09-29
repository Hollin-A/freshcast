// Response envelope shared by every JSON API route and the client.
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
