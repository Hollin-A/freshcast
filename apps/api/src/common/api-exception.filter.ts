import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import type { ApiErrorBody } from "@freshcast/shared";
import { ApiException } from "./api-exception.js";

// Codes for Nest's own HTTP errors (unknown route, malformed JSON body, ...),
// using the same codes the Next.js API returns for these statuses.
const CODE_BY_STATUS: Record<number, string> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "RATE_LIMITED",
  503: "SERVICE_UNAVAILABLE",
};

const INTERNAL_ERROR: ApiErrorBody = {
  error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
};

/**
 * Turns every error into the standard error envelope (ADR-020, #13).
 * Expected errors log a warning (4xx) or error (5xx) with their code, like
 * errorResponse() in the web app; unexpected errors are logged with their
 * stack and returned as a generic 500 so internals never reach the client.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("api");

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toEnvelope(exception);
    response.status(status).json(body);
  }

  private toEnvelope(exception: unknown): { status: number; body: ApiErrorBody } {
    if (exception instanceof ApiException) {
      this.logExpected(exception.getStatus(), exception.code, exception.message, exception.details);
      return { status: exception.getStatus(), body: exception.toBody() };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) return this.unexpected(exception);
      const code = CODE_BY_STATUS[status] ?? "BAD_REQUEST";
      this.logExpected(status, code, exception.message);
      return { status, body: { error: { code, message: exception.message } } };
    }

    return this.unexpected(exception);
  }

  private logExpected(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ): void {
    const line = `${code}: ${message}`;
    const fields = details ? { data: details } : {};
    if (status >= 500) this.logger.error(fields, line);
    else this.logger.warn(fields, line);
  }

  private unexpected(exception: unknown): { status: number; body: ApiErrorBody } {
    this.logger.error({ err: exception }, "Unhandled error in route handler");
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: INTERNAL_ERROR };
  }
}
