import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, errorResponse } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { getSecret } from "@/lib/secrets";
import { sendWeeklySummary } from "@/services/weekly-email";
import { withRequestLogging } from "@/lib/request-logging";

// Not currently scheduled; the weekly email is rebuilt on a job queue in #42.
async function handlePost(request: NextRequest) {
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

    return ok({ sent, failed, total: businesses.length });
  } catch (err) {
    logger.error("email", "POST /api/email/weekly-summary failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}

export const POST = withRequestLogging(handlePost);
