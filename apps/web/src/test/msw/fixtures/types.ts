import type { BUSINESS_TYPES } from "@freshcast/shared";
import type { DashboardData } from "@/hooks/use-dashboard";
import type { DayForecast } from "@/hooks/use-predictions";
import type { Product } from "@/hooks/use-products";
import type { SalesEntry } from "@/hooks/use-sales";

// The data one business sees across the App. Response types come from the
// hooks that consume them, so a fixture stops compiling when a hook's
// expected shape changes.
export type Scenario = {
  business: { id: string; name: string; type: (typeof BUSINESS_TYPES)[number] };
  products: Product[];
  sales: SalesEntry[];
  dashboard: DashboardData;
  /** `null` makes /api/predictions answer 422, as with under 5 days of sales. */
  dayForecast: DayForecast | null;
};

/** Fixtures are pinned to one date so stories and screenshots stay stable. */
export const FIXTURE_TODAY = "2026-06-15";

/** `YYYY-MM-DD` for `offset` days from FIXTURE_TODAY. */
export function fixtureDate(offset: number): string {
  const d = new Date(`${FIXTURE_TODAY}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().split("T")[0];
}
