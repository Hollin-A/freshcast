import { describe, expect, it } from "vitest";
import { BusinessDate } from "./business-date.js";

const d = BusinessDate.parse;

describe("BusinessDate", () => {
  describe("parse", () => {
    it("accepts a YYYY-MM-DD calendar date", () => {
      expect(d("2026-11-21")).toBe("2026-11-21");
      expect(d("2028-02-29")).toBe("2028-02-29");
    });

    it.each(["2026-02-29", "2026-02-30", "2026-13-01", "2026-1-5", "2026-11-21T00:00:00Z", ""])(
      "rejects %j",
      (value) => {
        expect(() => d(value)).toThrow();
      }
    );

    it("tells whether a value is a Business date", () => {
      expect(BusinessDate.is("2026-11-21")).toBe(true);
      expect(BusinessDate.is("2026-11-31")).toBe(false);
      expect(BusinessDate.is(20261121)).toBe(false);
    });
  });

  describe("addDays", () => {
    it("moves forward and back across month and year ends", () => {
      expect(BusinessDate.addDays(d("2026-11-30"), 1)).toBe("2026-12-01");
      expect(BusinessDate.addDays(d("2026-12-31"), 1)).toBe("2027-01-01");
      expect(BusinessDate.addDays(d("2027-01-01"), -1)).toBe("2026-12-31");
      expect(BusinessDate.addDays(d("2026-11-21"), -13)).toBe("2026-11-08");
      expect(BusinessDate.addDays(d("2026-11-21"), 0)).toBe("2026-11-21");
    });

    it("handles leap days", () => {
      expect(BusinessDate.addDays(d("2028-02-28"), 1)).toBe("2028-02-29");
      expect(BusinessDate.addDays(d("2028-02-29"), 1)).toBe("2028-03-01");
      expect(BusinessDate.addDays(d("2026-02-28"), 1)).toBe("2026-03-01");
    });

    it("isn't moved by daylight saving", () => {
      // Sydney's clocks go forward on 2026-10-04; a date has no clock.
      expect(BusinessDate.addDays(d("2026-10-03"), 1)).toBe("2026-10-04");
      expect(BusinessDate.addDays(d("2026-10-04"), 1)).toBe("2026-10-05");
    });

    it("rejects a fractional day count", () => {
      expect(() => BusinessDate.addDays(d("2026-11-21"), 1.5)).toThrow(RangeError);
    });
  });

  describe("weekday", () => {
    it("numbers days from Sunday (0) to Saturday (6)", () => {
      expect(BusinessDate.weekday(d("2026-11-22"))).toBe(0); // Sunday
      expect(BusinessDate.weekday(d("2026-11-23"))).toBe(1); // Monday
      expect(BusinessDate.weekday(d("2026-11-21"))).toBe(6); // Saturday
      expect(BusinessDate.weekday(d("2028-02-29"))).toBe(2); // Tuesday
    });
  });

  describe("compare", () => {
    it("orders dates by the calendar", () => {
      expect(BusinessDate.compare(d("2026-11-21"), d("2026-11-22"))).toBe(-1);
      expect(BusinessDate.compare(d("2026-11-22"), d("2026-11-21"))).toBe(1);
      expect(BusinessDate.compare(d("2026-11-21"), d("2026-11-21"))).toBe(0);
      expect(BusinessDate.compare(d("2026-12-31"), d("2027-01-01"))).toBe(-1);
    });

    it("sorts an array", () => {
      const dates = [d("2027-01-01"), d("2026-11-21"), d("2026-12-31")];
      expect(dates.sort(BusinessDate.compare)).toEqual(["2026-11-21", "2026-12-31", "2027-01-01"]);
    });
  });

  describe("database conversion", () => {
    // Prisma reads and writes @db.Date columns as UTC midnight.
    it("converts to the UTC-midnight Date Prisma stores", () => {
      expect(BusinessDate.toDbDate(d("2026-11-21")).toISOString()).toBe("2026-11-21T00:00:00.000Z");
    });

    it("reads a @db.Date back as the same calendar date", () => {
      expect(BusinessDate.fromDbDate(new Date("2026-11-21T00:00:00.000Z"))).toBe("2026-11-21");
      expect(BusinessDate.fromDbDate(BusinessDate.toDbDate(d("2028-02-29")))).toBe("2028-02-29");
    });

    it("refuses a Date that isn't a UTC midnight", () => {
      expect(() => BusinessDate.fromDbDate(new Date("2026-11-21T13:00:00.000Z"))).toThrow(RangeError);
      expect(() => BusinessDate.fromDbDate(new Date(Number.NaN))).toThrow(RangeError);
    });
  });

  describe("daysOf", () => {
    it("lists every date in a window, both ends included", () => {
      expect(BusinessDate.daysOf({ from: d("2028-02-27"), to: d("2028-03-01") })).toEqual([
        "2028-02-27",
        "2028-02-28",
        "2028-02-29",
        "2028-03-01",
      ]);
      expect(BusinessDate.daysOf({ from: d("2026-12-30"), to: d("2027-01-02") })).toEqual([
        "2026-12-30",
        "2026-12-31",
        "2027-01-01",
        "2027-01-02",
      ]);
      expect(BusinessDate.daysOf({ from: d("2026-11-21"), to: d("2026-11-21") })).toEqual(["2026-11-21"]);
    });

    it("rejects a window that ends before it starts", () => {
      expect(() => BusinessDate.daysOf({ from: d("2026-11-22"), to: d("2026-11-21") })).toThrow(RangeError);
    });
  });
});
