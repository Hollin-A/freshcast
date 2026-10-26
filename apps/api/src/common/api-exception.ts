import { HttpException } from "@nestjs/common";
import { PROBLEM_TYPE_BASE, type ProblemCode, type ProblemDetails } from "@freshcast/shared";

/**
 * An expected API error with a stable code from PROBLEM_CODES, sent to the
 * client as RFC 9457 Problem Details by ApiExceptionFilter (ADR-023).
 * `detail` is the human-readable message for this occurrence; `title`
 * defaults to the code in words ("RATE_LIMITED" → "Rate limited"). `extensions` adds
 * extra members to the problem, as RFC 9457 allows.
 */
export class ApiException extends HttpException {
  readonly title: string;
  readonly errors?: Record<string, string[]>;
  readonly extensions?: Record<string, unknown>;

  constructor(
    readonly code: ProblemCode,
    detail: string,
    status: number,
    options: {
      title?: string;
      errors?: Record<string, string[]>;
      extensions?: Record<string, unknown>;
    } = {}
  ) {
    super(detail, status);
    this.title = options.title ?? titleFromCode(code);
    this.errors = options.errors;
    this.extensions = options.extensions;
  }

  toProblem(): ProblemDetails {
    return {
      // First, so an extension can't replace a standard member.
      ...this.extensions,
      type: problemType(this.code),
      title: this.title,
      status: this.getStatus(),
      detail: this.message,
      code: this.code,
      ...(this.errors && { errors: this.errors }),
    };
  }
}

export function problemType(code: ProblemCode): string {
  return PROBLEM_TYPE_BASE + code.toLowerCase().replaceAll("_", "-");
}

export function titleFromCode(code: ProblemCode): string {
  const words = code.toLowerCase().replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
