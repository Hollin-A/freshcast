import { FIXTURE_TODAY, fixtureDate, type Scenario } from "./types";

// A business that finished onboarding but has logged no sales yet.

export const empty: Scenario = {
  business: { id: "biz_empty", name: "Corner Cafe", type: "CAFE" },
  products: [
    { id: "prod_flatwhite", name: "Flat white", defaultUnit: null, isActive: true, avgPerDay: null, trend: null },
    { id: "prod_croissant", name: "Croissant", defaultUnit: null, isActive: true, avgPerDay: null, trend: null },
  ],
  sales: [],
  dayForecast: null,
  dashboard: {
    hasAnySales: false,
    totalEntries: 0,
    todaySummary: { date: FIXTURE_TODAY, totalItems: 0, totalQuantity: 0, items: [] },
    weekSummary: {
      totalQuantity: 0,
      previousWeekQuantity: 0,
      changePercent: 0,
      dailyBreakdown: Array.from({ length: 7 }, (_, i) => ({
        date: fixtureDate(i - 6),
        totalQuantity: 0,
      })),
    },
    topProducts: [],
    forecast: null,
    weeklyForecast: null,
    insights: [],
    lastUpdated: `${FIXTURE_TODAY}T09:00:00.000Z`,
  },
};
