import type { SalesEntry } from "@/hooks/use-sales";
import { FIXTURE_TODAY, fixtureDate, type Scenario } from "./types";

// A butcher with two weeks of daily sales: every dashboard card has data.

const products = [
  { id: "prod_lamb", name: "Lamb chops", defaultUnit: "kg", isActive: true, avgPerDay: 11.4, trend: 8 },
  { id: "prod_beef", name: "Minced beef", defaultUnit: "kg", isActive: true, avgPerDay: 7.9, trend: -4 },
  { id: "prod_chicken", name: "Whole chicken", defaultUnit: null, isActive: true, avgPerDay: 5.3, trend: 12 },
  { id: "prod_sausage", name: "Sausages", defaultUnit: "kg", isActive: true, avgPerDay: 3.1, trend: 0 },
] satisfies Scenario["products"];

// Fixed quantities per product for the last 14 days, oldest first.
const DAILY: Record<string, number[]> = {
  prod_lamb: [9, 10, 12, 11, 13, 15, 8, 10, 11, 12, 12, 14, 16, 12],
  prod_beef: [8, 7, 9, 8, 8, 10, 6, 7, 8, 8, 7, 9, 9, 8],
  prod_chicken: [4, 5, 5, 4, 6, 7, 3, 5, 5, 6, 5, 6, 7, 5],
  prod_sausage: [3, 3, 2, 3, 4, 5, 2, 3, 3, 3, 2, 4, 4, 3],
};

const sales: SalesEntry[] = Array.from({ length: 14 }, (_, i) => {
  const date = fixtureDate(i - 13);
  return {
    id: `entry_${date}`,
    date: `${date}T00:00:00.000Z`,
    inputMethod: "NATURAL_LANGUAGE",
    rawInput: null,
    receiptKey: null,
    createdAt: `${date}T18:30:00.000Z`,
    items: products.map((p) => ({
      id: `item_${date}_${p.id}`,
      quantity: DAILY[p.id][i],
      unit: p.defaultUnit,
      product: { id: p.id, name: p.name },
    })),
  };
}).reverse();

const dayTotal = (i: number) => products.reduce((sum, p) => sum + DAILY[p.id][i], 0);
const thisWeek = Array.from({ length: 7 }, (_, i) => dayTotal(i + 7));
const lastWeek = Array.from({ length: 7 }, (_, i) => dayTotal(i));
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const weekChange = Math.round(((sum(thisWeek) - sum(lastWeek)) / sum(lastWeek)) * 1000) / 10;

const forecastPredictions = [
  { product: "Lamb chops", productId: "prod_lamb", predictedQuantity: 13, unit: "kg", confidence: 0.82 },
  { product: "Minced beef", productId: "prod_beef", predictedQuantity: 8, unit: "kg", confidence: 0.78 },
  { product: "Whole chicken", productId: "prod_chicken", predictedQuantity: 6, unit: null, confidence: 0.74 },
  { product: "Sausages", productId: "prod_sausage", predictedQuantity: 3, unit: "kg", confidence: 0.69 },
];

const today = sales[0];

export const onboarded: Scenario = {
  business: { id: "biz_onboarded", name: "Hilltop Butchers", type: "BUTCHER" },
  products,
  sales,
  dayForecast: {
    forecastDate: fixtureDate(1),
    predictions: forecastPredictions,
    dataPoints: 14,
    generatedAt: `${FIXTURE_TODAY}T19:00:00.000Z`,
  },
  dashboard: {
    hasAnySales: true,
    totalEntries: sales.length,
    todaySummary: {
      date: FIXTURE_TODAY,
      totalItems: today.items.length,
      totalQuantity: sum(today.items.map((i) => i.quantity)),
      items: today.items.map((i) => ({ product: i.product.name, quantity: i.quantity, unit: i.unit })),
    },
    weekSummary: {
      totalQuantity: sum(thisWeek),
      previousWeekQuantity: sum(lastWeek),
      changePercent: weekChange,
      dailyBreakdown: thisWeek.map((totalQuantity, i) => ({ date: fixtureDate(i - 6), totalQuantity })),
    },
    topProducts: products.map((p, i) => ({
      product: p.name,
      productId: p.id,
      totalQuantity: sum(DAILY[p.id].slice(7)),
      unit: p.defaultUnit,
      rank: i + 1,
    })),
    forecast: {
      forecastDate: fixtureDate(1),
      predictions: forecastPredictions.map((p) => {
        const pastWeek = DAILY[p.productId].slice(7);
        const recentAvg = Math.round((sum(pastWeek) / 7) * 10) / 10;
        const change = Math.round(((p.predictedQuantity - recentAvg) / recentAvg) * 100);
        return {
          ...p,
          holidayAdjusted: false,
          pastWeek,
          recentAvg,
          trend: `${change > 0 ? "+" : ""}${change}%`,
          breakdown: { weekdayAvg: p.predictedQuantity, recentAvg, holidayMultiplier: 1 },
        };
      }),
      dataPoints: 14,
      holiday: null,
    },
    weeklyForecast: forecastPredictions.map((p) => ({
      product: p.product,
      productId: p.productId,
      unit: p.unit,
      daily: Array.from({ length: 7 }, (_, i) => {
        const date = fixtureDate(i + 1);
        return {
          date,
          dayOfWeek: new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-US", {
            weekday: "short",
            timeZone: "UTC",
          }),
          predictedQuantity: p.predictedQuantity + (i % 3) - 1,
        };
      }),
    })),
    insights: [
      {
        id: "ins_trend",
        type: "TREND",
        content: "Whole chicken sales up 12%",
        metadata: { productId: "prod_chicken", change: 12, description: "Biggest mover this week." },
      },
      {
        id: "ins_comparison",
        type: "COMPARISON",
        content: `Total sales up ${Math.round(weekChange)}% vs last week`,
        metadata: { thisTotal: sum(thisWeek), prevTotal: sum(lastWeek), description: "Momentum is building." },
      },
      {
        id: "ins_top",
        type: "TOP_PRODUCTS",
        content: "Top 3 drive 87% of volume",
        metadata: { concentration: 87, description: "Focus your prep there." },
      },
      {
        id: "ins_summary",
        type: "SUMMARY",
        content: `${sum(thisWeek)} units this week`,
        metadata: { totalUnits: sum(thisWeek), productCount: 4, description: "Across 4 products." },
      },
    ],
    lastUpdated: `${FIXTURE_TODAY}T19:00:00.000Z`,
  },
};
