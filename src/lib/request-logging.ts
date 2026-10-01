import type { NextRequest } from "next/server";
import type { ApiErrorBody } from "@/schemas";
import { logger } from "./logger";
import { REQUEST_ID_HEADER, resolveRequestId, runWithRequestContext } from "./request-context";

type RouteHandler<C> = (request: NextRequest, context: C) => Response | Promise<Response>;

/**
 * Wraps a route handler so every request gets a request ID and one
 * "request completed" log line with method, path, status and duration.
 * Unhandled errors are logged and turned into the standard 500 envelope.
 * Query strings and bodies are never logged.
 */
export function withRequestLogging<C>(handler: RouteHandler<C>): RouteHandler<C> {
  return (request, context) => {
    const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));

    return runWithRequestContext({ requestId }, async () => {
      const start = performance.now();
      let response: Response;

      try {
        response = await handler(request, context);
      } catch (err) {
        logger.error("http", "Unhandled error in route handler", err);
        const body: ApiErrorBody = {
          error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
        };
        response = Response.json(body, { status: 500 });
      }

      const fields = {
        method: request.method,
        path: new URL(request.url).pathname,
        status: response.status,
        durationMs: Math.round(performance.now() - start),
      };
      if (response.status >= 500) logger.error("http", "request completed", fields);
      else if (response.status >= 400) logger.warn("http", "request completed", fields);
      else logger.info("http", "request completed", fields);

      try {
        response.headers.set(REQUEST_ID_HEADER, requestId);
      } catch {
        // Some responses (e.g. Response.redirect) have immutable headers.
      }
      return response;
    });
  };
}
