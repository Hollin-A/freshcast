import { z } from "zod";

declare const brand: unique symbol;

/**
 * A calendar date where the Business is, as `YYYY-MM-DD` (ADR-013). It has
 * no time or timezone: "2026-11-21" is the same day wherever it's read.
 * Get one from `BusinessCalendar` or `BusinessDate.parse()`, never by
 * formatting a `Date`.
 */
export type BusinessDate = string & { readonly [brand]: "BusinessDate" };

/** `z.iso.date()`, the check the shared request schemas use for dates. */
const isoDate = z.iso.date();

const MS_PER_DAY = 86_400_000;

function parse(value: string): BusinessDate {
  return isoDate.parse(value) as BusinessDate;
}

function is(value: unknown): value is BusinessDate {
  return isoDate.safeParse(value).success;
}

/** The date as UTC midnight, which is also how Prisma stores `@db.Date`. */
function toDbDate(date: BusinessDate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** Reads a `@db.Date` column. Any other Date is a mistake, so it throws. */
function fromDbDate(value: Date): BusinessDate {
  if (Number.isNaN(value.getTime()) || value.getTime() % MS_PER_DAY !== 0) {
    throw new RangeError(`Not a @db.Date value: ${String(value)}`);
  }
  return value.toISOString().slice(0, 10) as BusinessDate;
}

function addDays(date: BusinessDate, days: number): BusinessDate {
  if (!Number.isInteger(days)) throw new RangeError(`Not a whole number of days: ${days}`);
  return fromDbDate(new Date(toDbDate(date).getTime() + days * MS_PER_DAY));
}

/** 0 for Sunday through 6 for Saturday, as `Date#getDay()` numbers them. */
function weekday(date: BusinessDate): number {
  return toDbDate(date).getUTCDay();
}

/** Calendar order, usable with `Array#sort`. */
function compare(a: BusinessDate, b: BusinessDate): -1 | 0 | 1 {
  // Fixed-width YYYY-MM-DD strings sort in calendar order.
  return a < b ? -1 : a > b ? 1 : 0;
}

export const BusinessDate = { parse, is, addDays, weekday, compare, toDbDate, fromDbDate };
