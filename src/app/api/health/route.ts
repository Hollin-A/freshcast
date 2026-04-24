import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const startTime = Date.now();

export async function GET() {
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

  return NextResponse.json({
    status: dbStatus === "ok" ? "healthy" : "degraded",
    uptime: Math.round((Date.now() - startTime) / 1000),
    database: dbStatus,
    lastInsightGeneration: lastInsightTime,
    version: process.env.npm_package_version || "0.1.0",
    timestamp: new Date().toISOString(),
  });
}
