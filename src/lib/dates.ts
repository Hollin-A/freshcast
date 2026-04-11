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
 * Uses UTC since we store dates as UTC midnight.
 */
export function getUTCDayOfWeek(date: Date): number {
  return new Date(date).getUTCDay();
}
