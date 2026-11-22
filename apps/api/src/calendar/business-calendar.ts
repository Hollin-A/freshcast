import { Injectable } from "@nestjs/common";
import { BusinessDate, type DateWindow } from "./business-date.js";
import { Clock } from "./clock.js";

export type { DateWindow } from "./business-date.js";

/**
 * Dates as one Business sees them, fixed to one reading of the Clock, so
 * "today" can't change part-way through a request. Get one from
 * `BusinessCalendar.forBusiness()` once per request and pass it down.
 */
export class CalendarSnapshot {
  readonly today: BusinessDate;
  /** The date of the Next-day forecast. */
  readonly tomorrow: BusinessDate;

  constructor(today: BusinessDate) {
    this.today = today;
    this.tomorrow = BusinessDate.addDays(today, 1);
  }

  /** The 7 dates of the Week-ahead forecast, starting tomorrow. */
  weekAhead(): BusinessDate[] {
    return this.daysOf({ from: this.tomorrow, to: BusinessDate.addDays(this.today, 7) });
  }

  isFuture(date: BusinessDate): boolean {
    return BusinessDate.compare(date, this.today) > 0;
  }

  /**
   * The `days` dates ending today, or ending `weeksBack` whole weeks before
   * today. `trailing(7)` is this week (6 days ago through today) and
   * `trailing(7, { weeksBack: 1 })` the week before it.
   */
  trailing(days: number, { weeksBack = 0 }: { weeksBack?: number } = {}): DateWindow {
    if (!Number.isInteger(days) || days < 1) throw new RangeError(`days must be a positive integer: ${days}`);
    if (!Number.isInteger(weeksBack) || weeksBack < 0) {
      throw new RangeError(`weeksBack must be a non-negative integer: ${weeksBack}`);
    }
    const to = BusinessDate.addDays(this.today, -7 * weeksBack);
    return { from: BusinessDate.addDays(to, -(days - 1)), to };
  }

  /** Every date in `window`, in order, both ends included. */
  daysOf(window: DateWindow): BusinessDate[] {
    return BusinessDate.daysOf(window);
  }
}

/**
 * The only place the API turns an instant into a Business date (ADR-013).
 * A singleton: it holds no request state, so the services that inject it
 * stay singletons too.
 */
@Injectable()
export class BusinessCalendar {
  constructor(private readonly clock: Clock) {}

  /**
   * Throws a RangeError for a timezone `Intl` doesn't know. Business
   * timezones are checked when the Business is created, so that is a data
   * bug, not a reason to fall back to UTC.
   */
  forBusiness({ timezone }: { timezone: string }): CalendarSnapshot {
    return new CalendarSnapshot(dateIn(timezone, this.clock.now()));
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar date in `timezone` at `instant`. */
function dateIn(timezone: string, instant: Date): BusinessDate {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timezone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((p) => [p.type, p.value]));
  return BusinessDate.parse(`${parts.year}-${parts.month}-${parts.day}`);
}
