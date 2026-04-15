/**
 * Get the current date string (YYYY-MM-DD) in a given timezone.
 */
export function getLocalDateStr(timezone: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}

/**
 * Get a Date object representing midnight UTC for a local date string.
 * Since @db.Date stores just the calendar date, we use UTC midnight
 * as the canonical representation.
 */
export function toUTCDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00.000Z");
}

/**
 * Get today's date as a UTC Date object, based on the business timezone.
 */
export function getTodayUTC(timezone: string): Date {
  return toUTCDate(getLocalDateStr(timezone));
}

/**
 * Get a date N days ago as a UTC Date object, based on the business timezone.
 */
export function getDaysAgoUTC(timezone: string, n: number): Date {
  const today = getTodayUTC(timezone);
  today.setUTCDate(today.getUTCDate() - n);
  return today;
}

/**
 * Get the day of week (0=Sun, 6=Sat) for a date stored as @db.Date.
 * Parses the calendar date directly from the ISO string to avoid
 * any timezone conversion issues with JavaScript Date objects.
 */
export function getDayOfWeekFromDate(date: Date): number {
  // Extract YYYY-MM-DD from the date and construct at UTC midnight
  const isoStr = date.toISOString().split("T")[0];
  const [year, month, day] = isoStr.split("-").map(Number);
  // new Date(Date.UTC(...)) guarantees UTC interpretation
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}
