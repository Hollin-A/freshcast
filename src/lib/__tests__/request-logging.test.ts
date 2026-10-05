import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { withRequestLogging } from "../request-logging";
import { getRequestId, resolveRequestId } from "../request-context";
import { logger } from "../logger";

function makeRequest(url: string, init: RequestInit = {}) {
  return new Request(url, init) as unknown as NextRequest;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveRequestId", () => {
  it("reuses a well-formed incoming ID", () => {
    expect(resolveRequestId("abc-123_X.y")).toBe("abc-123_X.y");
  });

  it("generates a UUID when missing or malformed", () => {
    const uuid = /^[0-9a-f-]{36}$/;
    expect(resolveRequestId(null)).toMatch(uuid);
    expect(resolveRequestId("has spaces")).toMatch(uuid);
    expect(resolveRequestId("x".repeat(129))).toMatch(uuid);
  });
});

describe("withRequestLogging", () => {
  it("logs one line with method, path (no query), status and duration", async () => {
    const info = vi.spyOn(logger, "info").mockImplementation(() => {});
    const handler = withRequestLogging(async () => Response.json({ data: 1 }, { status: 201 }));

    await handler(makeRequest("http://localhost/api/sales?token=secret", { method: "POST" }), undefined);

    expect(info).toHaveBeenCalledTimes(1);
    const [context, message, fields] = info.mock.calls[0];
    expect(context).toBe("http");
    expect(message).toBe("request completed");
    expect(fields).toMatchObject({ method: "POST", path: "/api/sales", status: 201 });
    expect((fields as { durationMs: number }).durationMs).toBeGreaterThanOrEqual(0);
  });

  it("uses the incoming request ID, exposes it to the handler and returns it", async () => {
    vi.spyOn(logger, "info").mockImplementation(() => {});
    let seenInsideHandler: string | undefined;
    const handler = withRequestLogging(async () => {
      seenInsideHandler = getRequestId();
      return Response.json({ data: null });
    });

    const res = await handler(
      makeRequest("http://localhost/api/health", { headers: { "x-request-id": "req-42" } }),
      undefined
    );

    expect(seenInsideHandler).toBe("req-42");
    expect(res.headers.get("x-request-id")).toBe("req-42");
    expect(getRequestId()).toBeUndefined();
  });

  it("logs 4xx as warn and 5xx as error", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const error = vi.spyOn(logger, "error").mockImplementation(() => {});

    await withRequestLogging(async () => new Response(null, { status: 404 }))(
      makeRequest("http://localhost/api/sales/x"), undefined
    );
    await withRequestLogging(async () => new Response(null, { status: 503 }))(
      makeRequest("http://localhost/api/chat"), undefined
    );

    expect(warn).toHaveBeenCalledWith("http", "request completed", expect.objectContaining({ status: 404 }));
    expect(error).toHaveBeenCalledWith("http", "request completed", expect.objectContaining({ status: 503 }));
  });

  it("turns an unhandled error into the standard 500 envelope", async () => {
    const error = vi.spyOn(logger, "error").mockImplementation(() => {});
    const handler = withRequestLogging(async () => {
      throw new Error("boom");
    });

    const res = await handler(makeRequest("http://localhost/api/dashboard"), undefined);

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
    expect(error).toHaveBeenCalledWith("http", "Unhandled error in route handler", expect.any(Error));
    expect(error).toHaveBeenCalledWith("http", "request completed", expect.objectContaining({ status: 500 }));
  });

  it("passes the route context through to the handler", async () => {
    vi.spyOn(logger, "info").mockImplementation(() => {});
    const ctx = { params: Promise.resolve({ id: "s1" }) };
    const handler = withRequestLogging(async (_req, context: typeof ctx) => {
      const { id } = await context.params;
      return Response.json({ data: id });
    });

    const res = await handler(makeRequest("http://localhost/api/sales/s1"), ctx);
    await expect(res.json()).resolves.toEqual({ data: "s1" });
  });
});
