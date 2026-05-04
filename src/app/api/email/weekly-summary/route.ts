import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { getSecret } from "@/lib/secrets";
import { sendWeeklySummary } from "@/services/weekly-email";

// Called by EventBridge Scheduler (Amplify) or Vercel Cron (fallback) or manually.
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = await getSecret("CRON_SECRET", "freshcast/cron-secret");
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse("UNAUTHORIZED", "Invalid cron secret", 401);
    }

    // Find all businesses with weekly email enabled
    const businesses = await prisma.business.findMany({
      where: { weeklyEmailEnabled: true, onboarded: true },
      select: { id: true },
    });

    logger.info("email", "Weekly summary cron triggered", { businessCount: businesses.length });

    let sent = 0;
    let failed = 0;

    for (const biz of businesses) {
      const success = await sendWeeklySummary(biz.id);
      if (success) sent++;
      else failed++;
    }

    logger.info("email", "Weekly summary cron complete", { sent, failed });

    return NextResponse.json({ sent, failed, total: businesses.length });
  } catch (err) {
    logger.error("email", "POST /api/email/weekly-summary failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
