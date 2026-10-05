import { prisma } from "@/lib/prisma";
import { getTodayUTC, getDaysAgoUTC, getLocalDateStr, getDayOfWeekFromDate } from "@/lib/dates";

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

/**
 * Build a data context string for the AI chat based on the user's business data.
 * This gives Claude all the information it needs to answer business questions.
 */
export async function buildChatContext(
  businessId: string,
  timezone: string
): Promise<string> {
  const todayDate = getTodayUTC(timezone);
  const todayStr = getLocalDateStr(timezone);
  const weekStart = getDaysAgoUTC(timezone, 6);
  const prevWeekStart = getDaysAgoUTC(timezone, 13);
  const monthStart = getDaysAgoUTC(timezone, 29);

  // Fetch all relevant data in parallel
  const [business, products, todayEntries, weekEntries, prevWeekEntries, monthEntries, totalEntries] =
    await Promise.all([
      prisma.business.findUnique({
        where: { id: businessId },
        select: { name: true, type: true },
      }),
      prisma.product.findMany({
        where: { businessId, isActive: true },
        select: { name: true, defaultUnit: true },
      }),
      prisma.salesEntry.findMany({
        where: { businessId, date: { gte: todayDate } },
        include: { items: { include: { product: { select: { name: true } } } } },
      }),
      prisma.salesEntry.findMany({
        where: { businessId, date: { gte: weekStart } },
        include: { items: { include: { product: { select: { name: true } } } } },
      }),
      prisma.salesEntry.findMany({
        where: { businessId, date: { gte: prevWeekStart, lt: weekStart } },
        include: { items: { include: { product: { select: { name: true } } } } },
      }),
      prisma.salesEntry.findMany({
        where: { businessId, date: { gte: monthStart } },
        include: { items: { include: { product: { select: { name: true } } } } },
      }),
      prisma.salesEntry.count({ where: { businessId } }),
    ]);

  // Aggregate today's sales
  const todayProducts = new Map<string, number>();
  for (const entry of todayEntries) {
    for (const item of entry.items) {
      todayProducts.set(item.product.name, (todayProducts.get(item.product.name) ?? 0) + item.quantity);
    }
  }

  // Aggregate this week
  const weekProducts = new Map<string, number>();
  let weekTotal = 0;
  for (const entry of weekEntries) {
    for (const item of entry.items) {
      weekProducts.set(item.product.name, (weekProducts.get(item.product.name) ?? 0) + item.quantity);
      weekTotal += item.quantity;
    }
  }

  // Aggregate previous week
  let prevWeekTotal = 0;
  const prevWeekProducts = new Map<string, number>();
  for (const entry of prevWeekEntries) {
    for (const item of entry.items) {
      prevWeekProducts.set(item.product.name, (prevWeekProducts.get(item.product.name) ?? 0) + item.quantity);
      prevWeekTotal += item.quantity;
    }
  }

  // Weekday patterns from the month
  const weekdayTotals = new Map<string, number>();
  for (const entry of monthEntries) {
    const dayName = DAY_NAMES[getDayOfWeekFromDate(new Date(entry.date))];
    const qty = entry.items.reduce((s, i) => s + i.quantity, 0);
    weekdayTotals.set(dayName, (weekdayTotals.get(dayName) ?? 0) + qty);
  }

  // Build context string
  const lines: string[] = [];
  lines.push(`Business: ${business?.name} (${business?.type})`);
  lines.push(`Today's date: ${todayStr}`);
  lines.push(`Total sales entries in history: ${totalEntries}`);
  lines.push(`Products: ${products.map((p) => p.name + (p.defaultUnit ? ` (${p.defaultUnit})` : "")).join(", ")}`);
  lines.push("");

  if (todayProducts.size > 0) {
    lines.push("Today's sales:");
    for (const [name, qty] of todayProducts) lines.push(`  ${name}: ${qty}`);
  } else {
    lines.push("No sales logged today yet.");
  }
  lines.push("");

  lines.push(`This week total: ${Math.round(weekTotal)} units`);
  if (weekProducts.size > 0) {
    lines.push("This week by product:");
    const sorted = Array.from(weekProducts.entries()).sort((a, b) => b[1] - a[1]);
    for (const [name, qty] of sorted) lines.push(`  ${name}: ${Math.round(qty)}`);
  }
  lines.push("");

  if (prevWeekTotal > 0) {
    const change = ((weekTotal - prevWeekTotal) / prevWeekTotal) * 100;
    lines.push(`Previous week total: ${Math.round(prevWeekTotal)} units (${change > 0 ? "+" : ""}${Math.round(change)}% change)`);
  }
  lines.push("");

  if (weekdayTotals.size > 0) {
    lines.push("Average sales by day of week (last 30 days):");
    for (const [day, qty] of weekdayTotals) lines.push(`  ${day}: ${Math.round(qty)}`);
  }

  return lines.join("\n");
}
