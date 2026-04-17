/**
 * Public holiday data by region.
 * Each holiday has a type that determines the prediction multiplier:
 * - closed: most retail closed (multiplier 0.3)
 * - low: reduced traffic (multiplier 0.6)
 * - pre-holiday: day before a holiday (multiplier 1.2)
 * - post-holiday: day after a long weekend (multiplier 1.1)
 */

export type HolidayType = "closed" | "low" | "pre-holiday" | "post-holiday";

export type Holiday = {
  date: string; // YYYY-MM-DD
  name: string;
  type: HolidayType;
};

export const HOLIDAY_MULTIPLIERS: Record<HolidayType, number> = {
  closed: 0.3,
  low: 0.6,
  "pre-holiday": 1.2,
  "post-holiday": 1.1,
};

// Victoria, Australia public holidays 2026–2027
// Source: https://www.vic.gov.au/victorian-public-holidays
const AU_VIC_HOLIDAYS: Holiday[] = [
  // 2026
  { date: "2026-01-01", name: "New Year's Day", type: "closed" },
  { date: "2026-01-26", name: "Australia Day", type: "closed" },
  { date: "2026-01-25", name: "Day before Australia Day", type: "pre-holiday" },
  { date: "2026-03-09", name: "Labour Day", type: "closed" },
  { date: "2026-03-08", name: "Day before Labour Day", type: "pre-holiday" },
  { date: "2026-04-03", name: "Good Friday", type: "closed" },
  { date: "2026-04-02", name: "Day before Good Friday", type: "pre-holiday" },
  { date: "2026-04-04", name: "Saturday before Easter Sunday", type: "low" },
  { date: "2026-04-06", name: "Easter Monday", type: "closed" },
  { date: "2026-04-07", name: "Day after Easter", type: "post-holiday" },
  { date: "2026-04-25", name: "Anzac Day", type: "low" },
  { date: "2026-04-24", name: "Day before Anzac Day", type: "pre-holiday" },
  { date: "2026-06-08", name: "Queen's Birthday", type: "closed" },
  { date: "2026-06-07", name: "Day before Queen's Birthday", type: "pre-holiday" },
  { date: "2026-09-25", name: "Friday before AFL Grand Final", type: "closed" },
  { date: "2026-09-24", name: "Day before AFL Grand Final Friday", type: "pre-holiday" },
  { date: "2026-11-03", name: "Melbourne Cup", type: "low" },
  { date: "2026-11-02", name: "Day before Melbourne Cup", type: "pre-holiday" },
  { date: "2026-12-24", name: "Christmas Eve", type: "pre-holiday" },
  { date: "2026-12-25", name: "Christmas Day", type: "closed" },
  { date: "2026-12-26", name: "Boxing Day", type: "low" },
  { date: "2026-12-27", name: "Day after Boxing Day", type: "post-holiday" },

  // 2027
  { date: "2027-01-01", name: "New Year's Day", type: "closed" },
  { date: "2027-01-26", name: "Australia Day", type: "closed" },
  { date: "2027-01-25", name: "Day before Australia Day", type: "pre-holiday" },
  { date: "2027-03-08", name: "Labour Day", type: "closed" },
  { date: "2027-03-26", name: "Good Friday", type: "closed" },
  { date: "2027-03-25", name: "Day before Good Friday", type: "pre-holiday" },
  { date: "2027-03-27", name: "Saturday before Easter Sunday", type: "low" },
  { date: "2027-03-29", name: "Easter Monday", type: "closed" },
  { date: "2027-03-30", name: "Day after Easter", type: "post-holiday" },
  { date: "2027-04-25", name: "Anzac Day", type: "low" },
  { date: "2027-06-14", name: "Queen's Birthday", type: "closed" },
  { date: "2027-11-02", name: "Melbourne Cup", type: "low" },
  { date: "2027-12-24", name: "Christmas Eve", type: "pre-holiday" },
  { date: "2027-12-25", name: "Christmas Day", type: "closed" },
  { date: "2027-12-26", name: "Boxing Day", type: "low" },
];

const HOLIDAYS_BY_REGION: Record<string, Holiday[]> = {
  "AU-VIC": AU_VIC_HOLIDAYS,
};

/**
 * Get the holiday for a specific date and region, if any.
 */
export function getHoliday(
  dateStr: string,
  region: string
): Holiday | null {
  const holidays = HOLIDAYS_BY_REGION[region];
  if (!holidays) return null;
  return holidays.find((h) => h.date === dateStr) ?? null;
}

/**
 * Get the prediction multiplier for a date based on holidays.
 * Returns 1.0 if no holiday applies.
 */
export function getHolidayMultiplier(
  dateStr: string,
  region: string
): { multiplier: number; holiday: Holiday | null } {
  const holiday = getHoliday(dateStr, region);
  if (!holiday) return { multiplier: 1.0, holiday: null };
  return { multiplier: HOLIDAY_MULTIPLIERS[holiday.type], holiday };
}
