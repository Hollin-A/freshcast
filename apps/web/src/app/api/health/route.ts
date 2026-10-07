import { ok } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { withRequestLogging } from "@/lib/request-logging";
// Bundled at build time; npm_package_version is unset when server.js runs directly (Amplify).
import { version } from "../../../../package.json";

const startTime = Date.now();

async function handleGet() {
  let dbStatus = "ok";
  let lastInsightTime: string | null = null;

  try {
    // Check DB connectivity with a lightweight query
    await prisma.$queryRawUnsafe("SELECT 1");

    // Get last insight generation time
    const latestInsight = await prisma.dailyInsight.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    lastInsightTime = latestInsight?.createdAt.toISOString() ?? null;
  } catch {
    dbStatus = "error";
  }

  return ok({
    status: dbStatus === "ok" ? "healthy" : "degraded",
    uptime: Math.round((Date.now() - startTime) / 1000),
    database: dbStatus,
    lastInsightGeneration: lastInsightTime,
    version,
    timestamp: new Date().toISOString(),
  });
}

export const GET = withRequestLogging(handleGet);
