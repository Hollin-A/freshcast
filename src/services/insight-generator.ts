import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { InsightType } from "@/generated/prisma/client";
import { getDaysAgoUTC, getTodayUTC, getDayOfWeekFromDate } from "@/lib/dates";
import { generateJSON } from "@/lib/claude";
import { logger } from "@/lib/logger";

type InsightRecord = {
  type: InsightType;
  content: string;
  generationMethod: "template" | "llm";
  metadata?: Record<string, unknown>;
};

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

export async function generateInsights(
  businessId: string,
  timezone: string
): Promise<InsightRecord[]> {
  const insights: InsightRecord[] = [];

  const thisWeekStart = getDaysAgoUTC(timezone, 6);
  const prevWeekStart = getDaysAgoUTC(timezone, 13);

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
        generationMethod: "template",
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
        generationMethod: "template",
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
      generationMethod: "template",
      metadata: { concentration, topProducts: sorted.slice(0, 3).map((p) => p.name) },
    });
  }

  // SUMMARY: weekly aggregate
  const productCount = thisWeekTotals.size;
  insights.push({
    type: "SUMMARY",
    content: `You logged ${Math.round(thisTotal)} total units this week across ${productCount} product${productCount !== 1 ? "s" : ""}`,
    generationMethod: "template",
    metadata: { totalUnits: Math.round(thisTotal), productCount },
  });

  // Weekday pattern: find strongest and weakest days
  const weekdayTotals = new Map<number, number>();
  for (const entry of thisWeekEntries) {
    const day = getDayOfWeekFromDate(new Date(entry.date));
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
        generationMethod: "template",
        metadata: { strongestDay: DAY_NAMES[maxDay], slowestDay: DAY_NAMES[minDay] },
      });
    }
  }

  return insights;
}

const INSIGHT_SYSTEM_PROMPT = `You are a business analytics assistant for a small retail business. Given sales data, generate 3-5 short, actionable insights. Each insight should be one sentence, conversational, and helpful for a small business owner planning their stock.

Return a JSON array where each item has:
- "type": one of "TREND", "COMPARISON", "TOP_PRODUCTS", or "SUMMARY"
- "content": the insight text (one sentence, natural language)

Only use the data provided. Do not make assumptions about data you don't have. Be specific with numbers and percentages.`;

async function generateLLMInsights(
  thisWeekTotals: Map<string, { name: string; qty: number }>,
  prevWeekTotals: Map<string, { name: string; qty: number }>,
  weekdayTotals: Map<number, number>
): Promise<InsightRecord[] | null> {
  const thisTotal = Array.from(thisWeekTotals.values()).reduce((s, p) => s + p.qty, 0);
  const prevTotal = Array.from(prevWeekTotals.values()).reduce((s, p) => s + p.qty, 0);

  const dataContext = JSON.stringify({
    thisWeek: Object.fromEntries(
      Array.from(thisWeekTotals.entries()).map(([, v]) => [v.name, Math.round(v.qty)])
    ),
    previousWeek: Object.fromEntries(
      Array.from(prevWeekTotals.entries()).map(([, v]) => [v.name, Math.round(v.qty)])
    ),
    thisWeekTotal: Math.round(thisTotal),
    previousWeekTotal: Math.round(prevTotal),
    weekdayTotals: Object.fromEntries(
      Array.from(weekdayTotals.entries()).map(([day, qty]) => [DAY_NAMES[day], Math.round(qty)])
    ),
  });

  const result = await generateJSON<{ type: string; content: string }[]>(
    INSIGHT_SYSTEM_PROMPT,
    `Here is the sales data for this business:\n${dataContext}`,
    512
  );

  if (!result || !Array.isArray(result)) return null;

  const validTypes = new Set(["TREND", "COMPARISON", "TOP_PRODUCTS", "SUMMARY"]);

  return result
    .filter((r) => validTypes.has(r.type) && typeof r.content === "string")
    .slice(0, 5)
    .map((r) => ({
      type: r.type as InsightType,
      content: r.content,
      generationMethod: "llm" as const,
    }));
}

/**
 * Generate and store insights if stale (> 24 hours old or none exist).
 * Returns the current insights.
 */
export async function getOrGenerateInsights(businessId: string, timezone: string) {
  const todayDate = getTodayUTC(timezone);

  // Check if we have fresh insights
  const latest = await prisma.dailyInsight.findFirst({
    where: { businessId, date: { gte: todayDate } },
    orderBy: { createdAt: "desc" },
  });

  if (latest) {
    const insights = await prisma.dailyInsight.findMany({
      where: { businessId, date: { gte: todayDate } },
      select: { id: true, type: true, content: true, generationMethod: true },
    });
    return { insights, generatedAt: latest.createdAt.toISOString() };
  }

  // Stale — try LLM first, then fall back to templates
  // First gather the data both methods need
  const thisWeekStart = getDaysAgoUTC(timezone, 6);
  const prevWeekStart = getDaysAgoUTC(timezone, 13);

  const [thisWeekEntries, prevWeekEntries] = await Promise.all([
    prisma.salesEntry.findMany({
      where: { businessId, date: { gte: thisWeekStart } },
      include: { items: { include: { product: { select: { id: true, name: true } } } } },
    }),
    prisma.salesEntry.findMany({
      where: { businessId, date: { gte: prevWeekStart, lt: thisWeekStart } },
      include: { items: { include: { product: { select: { id: true, name: true } } } } },
    }),
  ]);

  if (thisWeekEntries.length === 0) {
    return { insights: [], generatedAt: new Date().toISOString() };
  }

  // Build aggregates
  const thisWeekTotals = new Map<string, { name: string; qty: number }>();
  const prevWeekTotals = new Map<string, { name: string; qty: number }>();
  const weekdayTotals = new Map<number, number>();

  for (const entry of thisWeekEntries) {
    const day = getDayOfWeekFromDate(new Date(entry.date));
    let dayQty = 0;
    for (const item of entry.items) {
      const existing = thisWeekTotals.get(item.productId);
      if (existing) existing.qty += item.quantity;
      else thisWeekTotals.set(item.productId, { name: item.product.name, qty: item.quantity });
      dayQty += item.quantity;
    }
    weekdayTotals.set(day, (weekdayTotals.get(day) ?? 0) + dayQty);
  }

  for (const entry of prevWeekEntries) {
    for (const item of entry.items) {
      const existing = prevWeekTotals.get(item.productId);
      if (existing) existing.qty += item.quantity;
      else prevWeekTotals.set(item.productId, { name: item.product.name, qty: item.quantity });
    }
  }

  // Try LLM insights first
  let generated: InsightRecord[] | null = null;
  generated = await generateLLMInsights(thisWeekTotals, prevWeekTotals, weekdayTotals);

  if (generated) {
    logger.info("insights", "Generated LLM insights", { count: generated.length });
  } else {
    // Fall back to template-based insights
    logger.info("insights", "Falling back to template insights");
    generated = await generateInsights(businessId, timezone);
  }

  if (generated.length > 0) {
    await prisma.dailyInsight.createMany({
      data: generated.map((g) => ({
        businessId,
        date: todayDate,
        type: g.type,
        content: g.content,
        generationMethod: g.generationMethod,
        metadata: g.metadata
          ? (g.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      })),
      skipDuplicates: true,
    });
  }

  const storedInsights = await prisma.dailyInsight.findMany({
    where: { businessId, date: { gte: todayDate } },
    select: { id: true, type: true, content: true, generationMethod: true },
  });

  return { insights: storedInsights, generatedAt: new Date().toISOString() };
}
