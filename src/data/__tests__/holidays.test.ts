import { describe, it, expect } from "vitest";
import { getHoliday, getHolidayMultiplier, HOLIDAY_MULTIPLIERS } from "../holidays";

describe("getHoliday", () => {
  it("returns holiday for Christmas Day", () => {
    const holiday = getHoliday("2026-12-25", "AU-VIC");
    expect(holiday).not.toBeNull();
    expect(holiday!.name).toBe("Christmas Day");
    expect(holiday!.type).toBe("closed");
  });

  it("returns holiday for a pre-holiday date", () => {
    const holiday = getHoliday("2026-12-24", "AU-VIC");
    expect(holiday).not.toBeNull();
    expect(holiday!.type).toBe("pre-holiday");
  });

  it("returns null for a normal day", () => {
    const holiday = getHoliday("2026-07-15", "AU-VIC");
    expect(holiday).toBeNull();
  });

  it("returns null for unknown region", () => {
    const holiday = getHoliday("2026-12-25", "US-CA");
    expect(holiday).toBeNull();
  });
});

describe("getHolidayMultiplier", () => {
  it("returns 0.3 for closed holidays (Christmas)", () => {
    const { multiplier } = getHolidayMultiplier("2026-12-25", "AU-VIC");
    expect(multiplier).toBe(0.3);
  });

  it("returns 0.6 for low-traffic holidays (Boxing Day)", () => {
    const { multiplier } = getHolidayMultiplier("2026-12-26", "AU-VIC");
    expect(multiplier).toBe(0.6);
  });

  it("returns 1.2 for pre-holiday dates", () => {
    const { multiplier } = getHolidayMultiplier("2026-12-24", "AU-VIC");
    expect(multiplier).toBe(1.2);
  });

  it("returns 1.1 for post-holiday dates", () => {
    const { multiplier } = getHolidayMultiplier("2026-12-27", "AU-VIC");
    expect(multiplier).toBe(1.1);
  });

  it("returns 1.0 for normal days", () => {
    const { multiplier, holiday } = getHolidayMultiplier("2026-07-15", "AU-VIC");
    expect(multiplier).toBe(1.0);
    expect(holiday).toBeNull();
  });

  it("returns the holiday object alongside the multiplier", () => {
    const { holiday } = getHolidayMultiplier("2026-04-03", "AU-VIC");
    expect(holiday).not.toBeNull();
    expect(holiday!.name).toBe("Good Friday");
  });
});

describe("HOLIDAY_MULTIPLIERS", () => {
  it("has correct values for all types", () => {
    expect(HOLIDAY_MULTIPLIERS.closed).toBe(0.3);
    expect(HOLIDAY_MULTIPLIERS.low).toBe(0.6);
    expect(HOLIDAY_MULTIPLIERS["pre-holiday"]).toBe(1.2);
    expect(HOLIDAY_MULTIPLIERS["post-holiday"]).toBe(1.1);
  });
});
