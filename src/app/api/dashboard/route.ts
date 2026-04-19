import { NextResponse } from "next/server";
import { errorResponse, getBusinessContext } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getTodaySummary, getWeekSummary, getTopProducts, getProductDailyHistory } from "@/services/analytics";
import { predictNextDay, predictNextWeek } from "@/services/prediction-engine";
import { getOrGenerateInsights } from "@/services/insight-generator";
import { getLocalDateStr, toUTCDate } from "@/lib/dates";

export async function GET() {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const { businessId, timezone, region } = ctx;

    const [todaySummary, weekSummary, topProducts, productHistory, predictions, weeklyPredictions, insightsResult, totalEntries] =
      await Promise.all([
        getTodaySummary(businessId, timezone),
        getWeekSummary(businessId, timezone),
        getTopProducts(businessId, timezone),
        getProductDailyHistory(businessId, timezone, 7),
        predictNextDay(businessId, timezone, region).catch(() => null),
        predictNextWeek(businessId, timezone, region).catch(() => null),
        getOrGenerateInsights(businessId, timezone).catch(() => ({
          insights: [],
          generatedAt: new Date().toISOString(),
        })),
        prisma.salesEntry.count({ where: { businessId } }),
      ]);

    const todayStr = getLocalDateStr(timezone);
    const tomorrowDate = toUTCDate(todayStr);
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);

    return NextResponse.json({
      hasAnySales: totalEntries > 0,
      totalEntries,
      todaySummary,
      weekSummary,
      topProducts,
      forecast: predictions
        ? {
            forecastDate: tomorrowDate.toISOString().split("T")[0],
            predictions: predictions.predictions.map((p) => {
              const history = productHistory.find((h) => h.productId === p.productId);
              return {
                ...p,
                pastWeek: history?.daily ?? [],
                recentAvg: history?.avgPerDay ?? 0,
                trend: history
                  ? (history.avgPerDay > 0
                    ? `${p.predictedQuantity > history.avgPerDay ? "+" : ""}${Math.round(((p.predictedQuantity - history.avgPerDay) / history.avgPerDay) * 100)}%`
                    : "")
                  : "",
              };
            }),
            dataPoints: predictions.dataPoints,
            holiday: predictions.holiday
              ? { name: predictions.holiday.name, type: predictions.holiday.type }
              : null,
          }
        : null,
      weeklyForecast: weeklyPredictions || null,
      insights: insightsResult.insights,
      lastUpdated: insightsResult.generatedAt,
    });
  } catch (err) {
    logger.error("dashboard", "GET /api/dashboard failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
