import { describe, expect, it, vi } from "vitest";
import { retry } from "./retry.js";

describe("retry", () => {
  it("returns the first successful result without waiting", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(retry(fn, { attempts: 3, initialDelayMs: 1_000 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries with doubling delays until it succeeds", async () => {
    vi.useFakeTimers();
    try {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("down"))
        .mockRejectedValueOnce(new Error("down"))
        .mockResolvedValue("ok");
      const onRetry = vi.fn();
      const result = retry(fn, { attempts: 5, initialDelayMs: 100, onRetry });
      await vi.runAllTimersAsync();
      await expect(result).resolves.toBe("ok");
      expect(fn).toHaveBeenCalledTimes(3);
      expect(onRetry.mock.calls.map(([, attempt, delay]) => [attempt, delay])).toEqual([
        [1, 100],
        [2, 200],
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rethrows the last error once attempts run out", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("last"));
    await expect(retry(fn, { attempts: 2, initialDelayMs: 0 })).rejects.toThrow("last");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
