import { HttpException } from "@nestjs/common";
import { PROBLEM_TYPE_BASE, type ProblemDetails } from "@freshcast/shared";

/**
 * An expected API error with a stable code, sent to the client as RFC 9457
 * Problem Details by ApiExceptionFilter (ADR-023). `detail` is the
 * human-readable message for this occurrence; `title` defaults to the code
 * in words ("ENTRY_NOT_EDITABLE" → "Entry not editable").
 */
export class ApiException extends HttpException {
  readonly title: string;
  readonly errors?: Record<string, string[]>;

  constructor(
    readonly code: string,
    detail: string,
    status: number,
    options: { title?: string; errors?: Record<string, string[]> } = {}
  ) {
    super(detail, status);
    this.title = options.title ?? titleFromCode(code);
    this.errors = options.errors;
  }

  toProblem(): ProblemDetails {
    return {
      type: problemType(this.code),
      title: this.title,
      status: this.getStatus(),
      detail: this.message,
      code: this.code,
      ...(this.errors && { errors: this.errors }),
    };
  }
}

export function problemType(code: string): string {
  return PROBLEM_TYPE_BASE + code.toLowerCase().replaceAll("_", "-");
}

export function titleFromCode(code: string): string {
  const words = code.toLowerCase().replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
