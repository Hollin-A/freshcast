import { prisma } from "@/lib/prisma";

type DateRange = { from: Date; to: Date };

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

export type PeriodComparison = {
  currentTotal: number;
  previousTotal: number;
  changePercent: number;
};

export type RankedProduct = ProductTotal & { rank: number };

function startOfDayUTC(d: Date): Date {
  const str = d.toISOString().split("T")[0];
  return new Date(str + "T00:00:00.000Z");
}

function daysAgoUTC(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return startOfDayUTC(d);
}

export async function getTodaySummary(businessId: string) {
  // Use UTC date to match @db.Date storage
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const todayDate = new Date(todayStr + "T00:00:00.000Z");
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);

  const entry = await prisma.salesEntry.findFirst({
    where: { businessId, date: { gte: todayDate, lt: tomorrowDate } },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, defaultUnit: true } } },
      },
    },
  });

  if (!entry) {
    return { date: todayStr, totalItems: 0, totalQuantity: 0, items: [] };
  }

  const items = entry.items.map((i) => ({
    product: i.product.name,
    quantity: i.quantity,
    unit: i.unit ?? i.product.defaultUnit ?? null,
  }));

  return {
    date: todayStr,
    totalItems: items.length,
    totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
    items,
  };
}

export async function getWeekSummary(businessId: string): Promise<{
  totalQuantity: number;
  previousWeekQuantity: number;
  changePercent: number;
  dailyBreakdown: DailyBreakdown[];
}> {
  const today = startOfDayUTC(new Date());
  const weekStart = daysAgoUTC(6); // last 7 days including today
  const prevWeekStart = daysAgoUTC(13);

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
    const d = daysAgoUTC(i);
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
  limit = 5
): Promise<RankedProduct[]> {
  const weekStart = daysAgoUTC(6);

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
