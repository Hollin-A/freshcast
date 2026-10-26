import { createRequire } from "node:module";
import { Controller, Get, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  HealthCheckService,
  type HealthIndicatorResult,
  PrismaHealthIndicator,
} from "@nestjs/terminus";
import type { HealthLive, HealthReady } from "@freshcast/shared";
import { ApiException } from "../common/api-exception.js";
import { Public } from "../common/public.decorator.js";
import type { Env } from "../config/env.schema.js";
import { PrismaService } from "../database/prisma.service.js";

// Long enough for a Neon cold start, short enough that a hung database
// doesn't hang the probe.
const DATABASE_TIMEOUT_MS = 3_000;

// src/health and dist/health both sit two levels below apps/api.
const { version: packageVersion } = createRequire(import.meta.url)("../../package.json") as {
  version: string;
};

type Checks = HealthReady["checks"];

/**
 * Liveness and readiness (ADR-023 §7). The ALB checks /health/live, which
 * never touches a dependency, so a database outage doesn't make ECS replace
 * healthy tasks. The deploy pipeline and monitoring use /health/ready.
 */
@Public()
@Controller("health")
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly version: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
    private readonly prisma: PrismaService
  ) {
    this.version = config.get("APP_VERSION", { infer: true }) ?? packageVersion;
  }

  @Get("live")
  live(): HealthLive {
    return { status: "ok", version: this.version, uptimeSeconds: Math.round(process.uptime()) };
  }

  @Get("ready")
  async ready(): Promise<HealthReady> {
    try {
      const result = await this.health.check([
        () => this.db.pingCheck("database", this.prisma, { timeout: DATABASE_TIMEOUT_MS }),
      ]);
      return { status: "ok", checks: statuses(result.details) };
    } catch (error) {
      // HealthCheckService throws a 503 carrying the result when a check fails.
      if (!(error instanceof ServiceUnavailableException)) throw error;
      const details = (error.getResponse() as { details: HealthIndicatorResult }).details;
      // The reasons (such as a timeout) go to the log only, never the client.
      this.logger.error({ data: { checks: details } }, "Readiness check failed");
      throw new ApiException("SERVICE_UNAVAILABLE", "A dependency is unavailable", 503, {
        extensions: { checks: statuses(details) },
      });
    }
  }
}

/** Keeps only each check's status. */
function statuses(details: HealthIndicatorResult): Checks {
  return Object.fromEntries(
    Object.entries(details).map(([key, { status }]) => [key, { status }])
  ) as Checks;
}
