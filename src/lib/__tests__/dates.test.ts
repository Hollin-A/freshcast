import { describe, it, expect } from "vitest";
import { toUTCDate, getDayOfWeekFromDate } from "../dates";

describe("toUTCDate", () => {
  it("creates a UTC midnight date from a date string", () => {
    const date = toUTCDate("2026-04-21");
    expect(date.toISOString()).toBe("2026-04-21T00:00:00.000Z");
  });

  it("handles month boundaries", () => {
    const date = toUTCDate("2026-01-31");
    expect(date.getUTCDate()).toBe(31);
    expect(date.getUTCMonth()).toBe(0); // January
  });
});

describe("getDayOfWeekFromDate", () => {
  it("returns correct day of week for known dates", () => {
    // April 21, 2026 is a Tuesday (2)
    expect(getDayOfWeekFromDate(new Date("2026-04-21T00:00:00Z"))).toBe(2);
    // April 19, 2026 is a Sunday (0)
    expect(getDayOfWeekFromDate(new Date("2026-04-19T00:00:00Z"))).toBe(0);
    // April 24, 2026 is a Friday (5)
    expect(getDayOfWeekFromDate(new Date("2026-04-24T00:00:00Z"))).toBe(5);
  });

  it("handles dates stored as @db.Date (UTC midnight)", () => {
    const date = new Date("2026-04-20T00:00:00.000Z"); // Monday
    expect(getDayOfWeekFromDate(date)).toBe(1);
  });
});
