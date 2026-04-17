import { prisma } from "@/lib/prisma";
import { getDayOfWeekFromDate, getLocalDateStr, toUTCDate } from "@/lib/dates";
import { MIN_ENTRIES_FOR_PREDICTIONS } from "@/lib/constants";
import { getHolidayMultiplier } from "@/data/holidays";
import type { Holiday } from "@/data/holidays";

export type ProductPrediction = {
  product: string;
  productId: string;
  predictedQuantity: number;
  unit: string | null;
  confidence: number;
  holidayAdjusted?: boolean;
};

export type DayPrediction = {
  date: string;
  dayOfWeek: string;
  predictedQuantity: number;
};

export type WeeklyProductPrediction = {
  product: string;
  productId: string;
  unit: string | null;
  daily: DayPrediction[];
};

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Confidence thresholds based on data volume
// More data points = higher base confidence in predictions
const CONFIDENCE_LOW_MAX = 5;       // < 5 entries: low confidence (0.3)
const CONFIDENCE_MODERATE_MAX = 15; // 5-14 entries: moderate (0.5)
const CONFIDENCE_GOOD_MAX = 30;     // 15-29 entries: good (0.7)
// 30+ entries: high confidence (0.85)

function calculateConfidence(
  sameWeekdayData: number[],
  recentData: number[]
): number {
  const totalPoints = sameWeekdayData.length + recentData.length;
  let base: number;
  if (totalPoints < CONFIDENCE_LOW_MAX) base = 0.3;
  else if (totalPoints < CONFIDENCE_MODERATE_MAX) base = 0.5;
  else if (totalPoints < CONFIDENCE_GOOD_MAX) base = 0.7;
  else base = 0.85;

  const allData = [...sameWeekdayData, ...recentData];
  if (allData.length >= 2) {
    const avg = mean(allData);
    if (avg > 0) {
      const variance =
        allData.reduce((sum, v) => sum + (v - avg) ** 2, 0) / allData.length;
      const cv = Math.sqrt(variance) / avg;
      base *= Math.max(0.5, 1 - cv * 0.3);
    }
  }
  return Math.round(base * 100) / 100;
}

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

async function getProductSalesHistory(
  businessId: string,
  productId: string,
  days: number,
  timezone: string
) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const entries = await prisma.salesEntry.findMany({
    where: {
      businessId,
      date: { gte: since },
    },
    include: {
      items: {
        where: { productId },
        select: { quantity: true },
      },
    },
    orderBy: { date: "desc" },
  });

  return entries
    .filter((e) => e.items.length > 0)
    .map((e) => ({
      date: new Date(e.date),
      dayOfWeek: getDayOfWeekFromDate(new Date(e.date)),
      quantity: e.items.reduce((s, i) => s + i.quantity, 0),
    }));
}

export async function predictNextDay(
  businessId: string,
  timezone: string,
  region: string = "AU-VIC"
): Promise<{ predictions: ProductPrediction[]; dataPoints: number; holiday: Holiday | null } | null> {
  const entryCount = await prisma.salesEntry.count({ where: { businessId } });
  if (entryCount < MIN_ENTRIES_FOR_PREDICTIONS) return null;

  const products = await prisma.product.findMany({
    where: { businessId, isActive: true },
    select: { id: true, name: true, defaultUnit: true },
  });

  // Tomorrow in the user's timezone
  const todayStr = getLocalDateStr(timezone);
  const todayDate = toUTCDate(todayStr);
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const targetWeekday = tomorrowDate.getUTCDay();

  const predictions: ProductPrediction[] = [];

  for (const product of products) {
    const history = await getProductSalesHistory(businessId, product.id, 60, timezone);
    if (history.length === 0) continue;

    const sameWeekday = history
      .filter((h) => h.dayOfWeek === targetWeekday)
      .slice(0, 4)
      .map((h) => h.quantity);

    const recent = history.slice(0, 7).map((h) => h.quantity);

    let predicted: number;
    if (sameWeekday.length === 0) predicted = mean(recent);
    else if (recent.length === 0) predicted = mean(sameWeekday);
    else predicted = 0.6 * mean(sameWeekday) + 0.4 * mean(recent);

    if (predicted <= 0) continue;

    // Apply holiday multiplier
    const tomorrowStr = tomorrowDate.toISOString().split("T")[0];
    const { multiplier, holiday: _ } = getHolidayMultiplier(tomorrowStr, region);
    const adjustedPrediction = Math.round(predicted * multiplier);

    predictions.push({
      product: product.name,
      productId: product.id,
      predictedQuantity: adjustedPrediction,
      unit: product.defaultUnit,
      confidence: calculateConfidence(sameWeekday, recent),
      holidayAdjusted: multiplier !== 1.0,
    });
  }

  const tomorrowStr = tomorrowDate.toISOString().split("T")[0];
  const { holiday } = getHolidayMultiplier(tomorrowStr, region);

  return {
    predictions: predictions.sort((a, b) => b.predictedQuantity - a.predictedQuantity),
    dataPoints: entryCount,
    holiday,
  };
}

export async function predictNextWeek(
  businessId: string,
  timezone: string,
  region: string = "AU-VIC"
): Promise<WeeklyProductPrediction[] | null> {
  const entryCount = await prisma.salesEntry.count({ where: { businessId } });
  if (entryCount < MIN_ENTRIES_FOR_PREDICTIONS) return null;

  const products = await prisma.product.findMany({
    where: { businessId, isActive: true },
    select: { id: true, name: true, defaultUnit: true },
  });

  const todayStr = getLocalDateStr(timezone);
  const todayDate = toUTCDate(todayStr);
  const result: WeeklyProductPrediction[] = [];

  for (const product of products) {
    const history = await getProductSalesHistory(businessId, product.id, 60, timezone);
    if (history.length === 0) continue;

    const daily: DayPrediction[] = [];

    for (let i = 1; i <= 7; i++) {
      const targetDate = new Date(todayDate);
      targetDate.setUTCDate(targetDate.getUTCDate() + i);
      const targetWeekday = targetDate.getUTCDay();

      const sameWeekday = history
        .filter((h) => h.dayOfWeek === targetWeekday)
        .slice(0, 4)
        .map((h) => h.quantity);

      const recent = history.slice(0, 7).map((h) => h.quantity);

      let predicted: number;
      if (sameWeekday.length === 0) predicted = mean(recent);
      else if (recent.length === 0) predicted = mean(sameWeekday);
      else predicted = 0.6 * mean(sameWeekday) + 0.4 * mean(recent);

      // Apply holiday multiplier
      const dateStr = targetDate.toISOString().split("T")[0];
      const { multiplier } = getHolidayMultiplier(dateStr, region);

      daily.push({
        date: dateStr,
        dayOfWeek: DAY_NAMES[targetWeekday],
        predictedQuantity: Math.round(Math.max(predicted * multiplier, 0)),
      });
    }

    if (daily.some((d) => d.predictedQuantity > 0)) {
      result.push({
        product: product.name,
        productId: product.id,
        unit: product.defaultUnit,
        daily,
      });
    }
  }

  return result;
}
