import { afterEach, describe, expect, it, vi } from "vitest";

// The logger picks its format from NODE_ENV at import time, so each test
// loads a fresh copy after setting the environment.
async function loadLogger(nodeEnv: string) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  const { logger } = await import("../logger");
  const { runWithRequestContext } = await import("../request-context");
  return { logger, runWithRequestContext };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("logger (production)", () => {
  it("writes one JSON object per line with the request ID", async () => {
    const { logger, runWithRequestContext } = await loadLogger("production");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    runWithRequestContext({ requestId: "req-1" }, () =>
      logger.info("http", "request completed", { status: 200 })
    );

    expect(log).toHaveBeenCalledTimes(1);
    const line = log.mock.calls[0][0] as string;
    expect(line).not.toContain("\n");
    expect(JSON.parse(line)).toMatchObject({
      level: "info",
      context: "http",
      message: "request completed",
      requestId: "req-1",
      data: { status: 200 },
    });
  });

  it("serializes errors with message and stack, to stderr", async () => {
    const { logger } = await loadLogger("production");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("api", "failed", new Error("boom"));

    const entry = JSON.parse(err.mock.calls[0][0] as string);
    expect(entry.requestId).toBeUndefined();
    expect(entry.data.error).toBe("boom");
    expect(entry.data.stack).toContain("Error: boom");
  });
});

describe("logger (development)", () => {
  it("keeps the readable format and shows a short request ID", async () => {
    const { logger, runWithRequestContext } = await loadLogger("development");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    runWithRequestContext({ requestId: "abcdef12-3456" }, () => logger.info("sales", "saved"));

    const line = log.mock.calls[0][0] as string;
    expect(line).toContain("[INFO]");
    expect(line).toContain("[sales] [req:abcdef12] saved");
  });
});
