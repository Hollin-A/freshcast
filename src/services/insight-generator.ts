import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { InsightType } from "@/generated/prisma/client";

type InsightRecord = {
  type: InsightType;
  content: string;
  metadata?: Record<string, unknown>;
};

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  const str = d.toISOString().split("T")[0];
  return new Date(str + "T00:00:00.000Z");
}

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

export async function generateInsights(
  businessId: string
): Promise<InsightRecord[]> {
  const insights: InsightRecord[] = [];

  const thisWeekStart = daysAgo(6);
  const prevWeekStart = daysAgo(13);

  const [thisWeekEntries, prevWeekEntries] = await Promise.all([
    prisma.salesEntry.findMany({
      where: { businessId, date: { gte: thisWeekStart } },
      include: {
        items: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.salesEntry.findMany({
      where: { businessId, date: { gte: prevWeekStart, lt: thisWeekStart } },
      include: {
        items: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  if (thisWeekEntries.length === 0) return insights;

  // Aggregate by product for both weeks
  const thisWeekTotals = new Map<string, { name: string; qty: number }>();
  const prevWeekTotals = new Map<string, { name: string; qty: number }>();

  for (const entry of thisWeekEntries) {
    for (const item of entry.items) {
      const existing = thisWeekTotals.get(item.productId);
      if (existing) existing.qty += item.quantity;
      else thisWeekTotals.set(item.productId, { name: item.product.name, qty: item.quantity });
    }
  }

  for (const entry of prevWeekEntries) {
    for (const item of entry.items) {
      const existing = prevWeekTotals.get(item.productId);
      if (existing) existing.qty += item.quantity;
      else prevWeekTotals.set(item.productId, { name: item.product.name, qty: item.quantity });
    }
  }

  // TREND insights: per-product week-over-week changes
  for (const [productId, current] of thisWeekTotals) {
    const prev = prevWeekTotals.get(productId);
    if (!prev || prev.qty === 0) continue;

    const change = ((current.qty - prev.qty) / prev.qty) * 100;
    const rounded = Math.round(Math.abs(change));

    if (rounded >= 10) {
      const direction = change > 0 ? "increased" : "decreased";
      insights.push({
        type: "TREND",
        content: `${current.name} sales ${direction} ${rounded}% this week`,
        metadata: { productId, change: Math.round(change) },
      });
    }
  }

  // COMPARISON: overall week-over-week
  const thisTotal = Array.from(thisWeekTotals.values()).reduce((s, p) => s + p.qty, 0);
  const prevTotal = Array.from(prevWeekTotals.values()).reduce((s, p) => s + p.qty, 0);

  if (prevTotal > 0) {
    const overallChange = ((thisTotal - prevTotal) / prevTotal) * 100;
    const rounded = Math.round(Math.abs(overallChange));
    if (rounded >= 5) {
      const direction = overallChange > 0 ? "up" : "down";
      insights.push({
        type: "COMPARISON",
        content: `Total sales ${direction} ${rounded}% compared to last week`,
        metadata: { thisTotal: Math.round(thisTotal), prevTotal: Math.round(prevTotal) },
      });
    }
  }

  // TOP_PRODUCTS: concentration
  const sorted = Array.from(thisWeekTotals.values()).sort((a, b) => b.qty - a.qty);
  if (sorted.length >= 3) {
    const top3Total = sorted.slice(0, 3).reduce((s, p) => s + p.qty, 0);
    const concentration = Math.round((top3Total / thisTotal) * 100);
    insights.push({
      type: "TOP_PRODUCTS",
      content: `Your top 3 products account for ${concentration}% of total sales`,
      metadata: { concentration, topProducts: sorted.slice(0, 3).map((p) => p.name) },
    });
  }

  // SUMMARY: weekly aggregate
  const productCount = thisWeekTotals.size;
  insights.push({
    type: "SUMMARY",
    content: `You logged ${Math.round(thisTotal)} total units this week across ${productCount} product${productCount !== 1 ? "s" : ""}`,
    metadata: { totalUnits: Math.round(thisTotal), productCount },
  });

  // Weekday pattern: find strongest and weakest days
  const weekdayTotals = new Map<number, number>();
  for (const entry of thisWeekEntries) {
    const day = new Date(entry.date).getUTCDay();
    const qty = entry.items.reduce((s, i) => s + i.quantity, 0);
    weekdayTotals.set(day, (weekdayTotals.get(day) ?? 0) + qty);
  }

  if (weekdayTotals.size >= 3) {
    let maxDay = 0, maxQty = 0, minDay = 0, minQty = Infinity;
    for (const [day, qty] of weekdayTotals) {
      if (qty > maxQty) { maxDay = day; maxQty = qty; }
      if (qty < minQty) { minDay = day; minQty = qty; }
    }
    if (maxQty > minQty) {
      insights.push({
        type: "SUMMARY",
        content: `${DAY_NAMES[maxDay]} is your strongest day, ${DAY_NAMES[minDay]} is your slowest`,
        metadata: { strongestDay: DAY_NAMES[maxDay], slowestDay: DAY_NAMES[minDay] },
      });
    }
  }

  return insights;
}

/**
 * Generate and store insights if stale (> 24 hours old or none exist).
 * Returns the current insights.
 */
export async function getOrGenerateInsights(businessId: string) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const todayDate = new Date(todayStr + "T00:00:00.000Z");

  // Check if we have fresh insights
  const latest = await prisma.dailyInsight.findFirst({
    where: { businessId, date: { gte: todayDate } },
    orderBy: { createdAt: "desc" },
  });

  if (latest) {
    // Fresh — return from DB
    const insights = await prisma.dailyInsight.findMany({
      where: { businessId, date: { gte: todayDate } },
      select: { id: true, type: true, content: true },
    });
    return { insights, generatedAt: latest.createdAt.toISOString() };
  }

  // Stale — regenerate
  const generated = await generateInsights(businessId);

  if (generated.length > 0) {
    await prisma.dailyInsight.createMany({
      data: generated.map((g) => ({
        businessId,
        date: todayDate,
        type: g.type,
        content: g.content,
        metadata: g.metadata
          ? (g.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      })),
    });
  }

  const insights = generated.map((g, i) => ({
    id: `generated-${i}`,
    type: g.type,
    content: g.content,
  }));

  return { insights, generatedAt: new Date().toISOString() };
}
