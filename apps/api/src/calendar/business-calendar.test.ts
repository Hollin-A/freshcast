import { describe, expect, it } from "vitest";
import { BusinessCalendar } from "./business-calendar.js";
import { BusinessDate } from "./business-date.js";
import { FixedClock } from "./clock.js";

/** The calendar a Business in `timezone` sees at `instant`. */
function at(instant: string, timezone: string) {
  return new BusinessCalendar(new FixedClock(new Date(instant))).forBusiness({ timezone });
}

const JUST_BEFORE = 1; // ms

function before(instant: string): string {
  return new Date(new Date(instant).getTime() - JUST_BEFORE).toISOString();
}

describe("BusinessCalendar", () => {
  describe("today and tomorrow", () => {
    it.each([
      // Kiritimati is UTC+14, so its midnight is 10:00 UTC the day before.
      { timezone: "Pacific/Kiritimati", midnight: "2026-11-21T10:00:00.000Z", before: "2026-11-21", after: "2026-11-22", next: "2026-11-23" },
      // Pago Pago is UTC−11, so its midnight is 11:00 UTC the same day.
      { timezone: "Pacific/Pago_Pago", midnight: "2026-11-22T11:00:00.000Z", before: "2026-11-21", after: "2026-11-22", next: "2026-11-23" },
      { timezone: "UTC", midnight: "2026-11-22T00:00:00.000Z", before: "2026-11-21", after: "2026-11-22", next: "2026-11-23" },
      // Sydney moves to UTC+11 at 02:00 on 2026-10-04, so the next
      // midnight is 13:00 UTC, not 14:00.
      { timezone: "Australia/Sydney", midnight: "2026-10-04T13:00:00.000Z", before: "2026-10-04", after: "2026-10-05", next: "2026-10-06" },
      // ...and back to UTC+10 at 03:00 on 2027-04-04: midnight is 14:00 UTC.
      { timezone: "Australia/Sydney", midnight: "2027-04-04T14:00:00.000Z", before: "2027-04-04", after: "2027-04-05", next: "2027-04-06" },
      // Year end, in the first timezone to reach it.
      { timezone: "Pacific/Kiritimati", midnight: "2026-12-31T10:00:00.000Z", before: "2026-12-31", after: "2027-01-01", next: "2027-01-02" },
      // Leap day, in the last.
      { timezone: "Pacific/Pago_Pago", midnight: "2028-02-29T11:00:00.000Z", before: "2028-02-28", after: "2028-02-29", next: "2028-03-01" },
    ])("changes date at midnight in $timezone ($after)", ({ timezone, midnight, before: dayBefore, after, next }) => {
      const justBefore = at(before(midnight), timezone);
      expect(justBefore.today).toBe(dayBefore);
      expect(justBefore.tomorrow).toBe(after);

      const atMidnight = at(midnight, timezone);
      expect(atMidnight.today).toBe(after);
      expect(atMidnight.tomorrow).toBe(next);
    });

    it("gives the day after today as tomorrow, across a year end and a leap day", () => {
      expect(at("2026-12-31T12:00:00.000Z", "UTC").tomorrow).toBe("2027-01-01");
      expect(at("2028-02-28T12:00:00.000Z", "UTC").tomorrow).toBe("2028-02-29");
      expect(at("2028-02-29T12:00:00.000Z", "UTC").tomorrow).toBe("2028-03-01");
    });

    it("can put two Businesses two dates apart at the same instant", () => {
      // 10:30 UTC is 00:30 on the 22nd in Kiritimati and 23:30 on the 20th
      // in Pago Pago.
      expect(at("2026-11-21T10:30:00.000Z", "Pacific/Kiritimati").today).toBe("2026-11-22");
      expect(at("2026-11-21T10:30:00.000Z", "Pacific/Pago_Pago").today).toBe("2026-11-20");
    });

    it("reads the clock once, so today can't change mid-request", () => {
      const clock = new FixedClock(new Date("2026-11-21T09:59:59.000Z"));
      const calendar = new BusinessCalendar(clock).forBusiness({ timezone: "Pacific/Kiritimati" });
      clock.set(new Date("2026-11-21T10:00:00.000Z"));

      expect(calendar.today).toBe("2026-11-21");
      expect(calendar.tomorrow).toBe("2026-11-22");
      expect(new BusinessCalendar(clock).forBusiness({ timezone: "Pacific/Kiritimati" }).today).toBe("2026-11-22");
    });

    it("throws on a timezone that isn't IANA", () => {
      expect(() => at("2026-11-21T12:00:00.000Z", "Mars/Olympus_Mons")).toThrow(RangeError);
    });
  });

  // Saturday 2026-11-21 in Sydney.
  const calendar = () => at("2026-11-21T01:00:00.000Z", "Australia/Sydney");
  const d = BusinessDate.parse;

  describe("weekAhead", () => {
    it("lists the 7 dates of the Week-ahead forecast, starting tomorrow", () => {
      expect(calendar().weekAhead()).toEqual([
        "2026-11-22",
        "2026-11-23",
        "2026-11-24",
        "2026-11-25",
        "2026-11-26",
        "2026-11-27",
        "2026-11-28",
      ]);
    });

    it("runs through a leap day", () => {
      expect(at("2028-02-26T12:00:00.000Z", "UTC").weekAhead()).toEqual([
        "2028-02-27",
        "2028-02-28",
        "2028-02-29",
        "2028-03-01",
        "2028-03-02",
        "2028-03-03",
        "2028-03-04",
      ]);
    });
  });

  describe("isFuture", () => {
    it("is true only after today", () => {
      expect(calendar().isFuture(d("2026-11-22"))).toBe(true);
      expect(calendar().isFuture(d("2027-01-01"))).toBe(true);
      expect(calendar().isFuture(d("2026-11-21"))).toBe(false);
      expect(calendar().isFuture(d("2026-11-20"))).toBe(false);
    });
  });

  describe("trailing", () => {
    it("ends today and includes both ends", () => {
      expect(calendar().trailing(7)).toEqual({ from: "2026-11-15", to: "2026-11-21" });
      expect(calendar().trailing(1)).toEqual({ from: "2026-11-21", to: "2026-11-21" });
      expect(calendar().trailing(28)).toEqual({ from: "2026-10-25", to: "2026-11-21" });
    });

    it("steps back whole weeks for comparisons", () => {
      // The Legacy "previous week": 13 through 7 days ago.
      expect(calendar().trailing(7, { weeksBack: 1 })).toEqual({ from: "2026-11-08", to: "2026-11-14" });
      expect(calendar().trailing(7, { weeksBack: 2 })).toEqual({ from: "2026-11-01", to: "2026-11-07" });
      expect(calendar().trailing(7, { weeksBack: 0 })).toEqual(calendar().trailing(7));
    });

    it.each([0, -1, 1.5])("rejects %s days", (days) => {
      expect(() => calendar().trailing(days)).toThrow(RangeError);
    });

    it.each([-1, 0.5])("rejects %s weeks back", (weeksBack) => {
      expect(() => calendar().trailing(7, { weeksBack })).toThrow(RangeError);
    });
  });

  describe("daysOf", () => {
    it("lists every date in a window, both ends included", () => {
      expect(calendar().daysOf({ from: d("2026-12-30"), to: d("2027-01-02") })).toEqual([
        "2026-12-30",
        "2026-12-31",
        "2027-01-01",
        "2027-01-02",
      ]);
      expect(calendar().daysOf({ from: d("2026-11-21"), to: d("2026-11-21") })).toEqual(["2026-11-21"]);
    });

    it("lists the days of a trailing window", () => {
      const days = calendar().daysOf(calendar().trailing(7));
      expect(days).toHaveLength(7);
      expect(days[0]).toBe("2026-11-15");
      expect(days[6]).toBe("2026-11-21");
    });

    it("rejects a window that ends before it starts", () => {
      expect(() => calendar().daysOf({ from: d("2026-11-22"), to: d("2026-11-21") })).toThrow(RangeError);
    });
  });
});
