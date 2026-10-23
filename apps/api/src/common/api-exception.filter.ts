import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import type { ProblemDetails } from "@freshcast/shared";
import { ApiException, problemType, titleFromCode } from "./api-exception.js";

// Codes for Nest's own HTTP errors (unknown route, malformed JSON body, ...).
const CODE_BY_STATUS: Record<number, string> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "RATE_LIMITED",
  503: "SERVICE_UNAVAILABLE",
};

const INTERNAL_ERROR: ProblemDetails = {
  type: problemType("INTERNAL_ERROR"),
  title: "Internal error",
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  detail: "Something went wrong",
  code: "INTERNAL_ERROR",
};

/**
 * Turns every error into RFC 9457 Problem Details (ADR-023).
 * Expected errors log a warning (4xx) or error (5xx) with their code;
 * unexpected errors are logged with their stack and returned as a generic
 * 500 so internals never reach the client.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("api");

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const problem = this.toProblem(exception);
    // Set before json(), which only defaults the type when none is set.
    response.status(problem.status).type("application/problem+json").json(problem);
  }

  private toProblem(exception: unknown): ProblemDetails {
    if (exception instanceof ApiException) {
      const problem = exception.toProblem();
      this.logExpected(problem);
      return problem;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) return this.unexpected(exception);
      const code = CODE_BY_STATUS[status] ?? "BAD_REQUEST";
      const problem: ProblemDetails = {
        type: problemType(code),
        title: titleFromCode(code),
        status,
        detail: exception.message,
        code,
      };
      this.logExpected(problem);
      return problem;
    }

    return this.unexpected(exception);
  }

  private logExpected(problem: ProblemDetails): void {
    const line = `${problem.code}: ${problem.detail}`;
    const fields = problem.errors ? { data: { errors: problem.errors } } : {};
    if (problem.status >= 500) this.logger.error(fields, line);
    else this.logger.warn(fields, line);
  }

  private unexpected(exception: unknown): ProblemDetails {
    this.logger.error({ err: exception }, "Unhandled error in route handler");
    return INTERNAL_ERROR;
  }
}
