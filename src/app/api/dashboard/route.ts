import { NextResponse } from "next/server";
import { errorResponse, getBusinessContext } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getTodaySummary, getWeekSummary, getTopProducts } from "@/services/analytics";
import { predictNextDay, predictNextWeek } from "@/services/prediction-engine";
import { getOrGenerateInsights } from "@/services/insight-generator";
import { getLocalDateStr, toUTCDate } from "@/lib/dates";

export async function GET() {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const { businessId, timezone } = ctx;

    const [todaySummary, weekSummary, topProducts, predictions, weeklyPredictions, insightsResult, totalEntries] =
      await Promise.all([
        getTodaySummary(businessId, timezone),
        getWeekSummary(businessId, timezone),
        getTopProducts(businessId, timezone),
        predictNextDay(businessId, timezone).catch(() => null),
        predictNextWeek(businessId, timezone).catch(() => null),
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
            predictions: predictions.predictions,
            dataPoints: predictions.dataPoints,
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
