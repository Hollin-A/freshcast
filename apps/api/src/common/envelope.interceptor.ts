import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  StreamableFile,
} from "@nestjs/common";
import { map, type Observable } from "rxjs";
import type { ApiSuccess } from "@freshcast/shared";
import { WithMeta } from "./envelope.js";

/**
 * Wraps every controller result in the success envelope `{ data, meta? }`
 * (ADR-020, #13), so handlers just return their payload. Files (e.g. the
 * CSV export) pass through unwrapped.
 */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((value: unknown) => toEnvelope(value)));
  }
}

export function toEnvelope(value: unknown): unknown {
  if (value instanceof StreamableFile) return value;
  if (value instanceof WithMeta) {
    const body: ApiSuccess<unknown> = { data: value.data, meta: value.meta };
    return body;
  }
  const body: ApiSuccess<unknown> = { data: value ?? null };
  return body;
}
