import { describe, it, expect } from "vitest";
import { rateLimit } from "../rate-limit";

describe("rateLimit", () => {
  it("allows requests within the limit", () => {
    const key = `test-allow-${Date.now()}`;
    const { success, remaining } = rateLimit(key, 5, 60000);
    expect(success).toBe(true);
    expect(remaining).toBe(4);
  });

  it("blocks requests beyond the limit", () => {
    const key = `test-block-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      rateLimit(key, 3, 60000);
    }
    const { success, remaining } = rateLimit(key, 3, 60000);
    expect(success).toBe(false);
    expect(remaining).toBe(0);
  });

  it("resets after window expires", () => {
    const key = `test-reset-${Date.now()}`;
    // Use a 1ms window so it expires immediately
    rateLimit(key, 1, 1);

    // Wait a tick for the window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const { success } = rateLimit(key, 1, 60000);
        expect(success).toBe(true);
        resolve();
      }, 10);
    });
  });
});
