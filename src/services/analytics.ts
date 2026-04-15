import { prisma } from "@/lib/prisma";
import {
  getTodayUTC,
  getDaysAgoUTC,
  getLocalDateStr,
  toUTCDate,
} from "@/lib/dates";

export type ProductTotal = {
  product: string;
  productId: string;
  totalQuantity: number;
  unit: string | null;
};

export type DailyBreakdown = {
  date: string;
  totalQuantity: number;
};

export type RankedProduct = ProductTotal & { rank: number };

export async function getTodaySummary(businessId: string, timezone: string) {
  const todayDate = getTodayUTC(timezone);
  const todayUpperBound = new Date(todayDate);
  todayUpperBound.setUTCDate(todayUpperBound.getUTCDate() + 1);
  const todayStr = getLocalDateStr(timezone);

  const entries = await prisma.salesEntry.findMany({
    where: { businessId, date: { gte: todayDate, lt: todayUpperBound } },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, defaultUnit: true } } },
      },
    },
  });

  if (entries.length === 0) {
    return { date: todayStr, totalItems: 0, totalQuantity: 0, items: [] };
  }

  // Aggregate items across all entries, merging same products
  const productTotals = new Map<
    string,
    { product: string; quantity: number; unit: string | null }
  >();

  for (const entry of entries) {
    for (const item of entry.items) {
      const existing = productTotals.get(item.productId);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        productTotals.set(item.productId, {
          product: item.product.name,
          quantity: item.quantity,
          unit: item.unit ?? item.product.defaultUnit ?? null,
        });
      }
    }
  }

  const items = Array.from(productTotals.values());

  return {
    date: todayStr,
    totalItems: items.length,
    totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
    items,
  };
}

export async function getWeekSummary(businessId: string, timezone: string): Promise<{
  totalQuantity: number;
  previousWeekQuantity: number;
  changePercent: number;
  dailyBreakdown: DailyBreakdown[];
}> {
  const today = getTodayUTC(timezone);
  const weekStart = getDaysAgoUTC(timezone, 6);
  const prevWeekStart = getDaysAgoUTC(timezone, 13);

  const [currentEntries, prevEntries] = await Promise.all([
    prisma.salesEntry.findMany({
      where: { businessId, date: { gte: weekStart, lte: today } },
      include: { items: true },
    }),
    prisma.salesEntry.findMany({
      where: { businessId, date: { gte: prevWeekStart, lt: weekStart } },
      include: { items: true },
    }),
  ]);

  const currentTotal = currentEntries.reduce(
    (sum, e) => sum + e.items.reduce((s, i) => s + i.quantity, 0),
    0
  );
  const prevTotal = prevEntries.reduce(
    (sum, e) => sum + e.items.reduce((s, i) => s + i.quantity, 0),
    0
  );

  const changePercent = prevTotal === 0 ? 0 : ((currentTotal - prevTotal) / prevTotal) * 100;

  // Build daily breakdown
  const dailyMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = getDaysAgoUTC(timezone, i);
    dailyMap.set(d.toISOString().split("T")[0], 0);
  }
  for (const entry of currentEntries) {
    const key = new Date(entry.date).toISOString().split("T")[0];
    const qty = entry.items.reduce((s, i) => s + i.quantity, 0);
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + qty);
  }

  const dailyBreakdown = Array.from(dailyMap.entries()).map(([date, totalQuantity]) => ({
    date,
    totalQuantity,
  }));

  return {
    totalQuantity: Math.round(currentTotal * 10) / 10,
    previousWeekQuantity: Math.round(prevTotal * 10) / 10,
    changePercent: Math.round(changePercent * 10) / 10,
    dailyBreakdown,
  };
}

export async function getTopProducts(
  businessId: string,
  timezone: string,
  limit = 5
): Promise<RankedProduct[]> {
  const weekStart = getDaysAgoUTC(timezone, 6);

  const entries = await prisma.salesEntry.findMany({
    where: { businessId, date: { gte: weekStart } },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, defaultUnit: true } } },
      },
    },
  });

  const totals = new Map<string, { name: string; id: string; qty: number; unit: string | null }>();
  for (const entry of entries) {
    for (const item of entry.items) {
      const key = item.productId;
      const existing = totals.get(key);
      if (existing) {
        existing.qty += item.quantity;
      } else {
        totals.set(key, {
          name: item.product.name,
          id: item.productId,
          qty: item.quantity,
          unit: item.unit ?? item.product.defaultUnit ?? null,
        });
      }
    }
  }

  return Array.from(totals.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit)
    .map((p, i) => ({
      product: p.name,
      productId: p.id,
      totalQuantity: Math.round(p.qty * 10) / 10,
      unit: p.unit,
      rank: i + 1,
    }));
}
