import { HttpException } from "@nestjs/common";
import type { ApiErrorBody } from "@freshcast/shared";

/**
 * An expected API error with a stable code, sent to the client as
 * `{ error: { code, message, details? } }` by ApiExceptionFilter.
 * Codes and statuses match the Next.js API (docs/API.md).
 */
export class ApiException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: number,
    readonly details?: Record<string, unknown>
  ) {
    super(message, status);
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}
