import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createPrismaAdapter, PrismaClient } from "@freshcast/db";
import type { Env } from "../config/env.schema.js";
import { retry, type RetryOptions } from "./retry.js";

// Startup tries the database 5 times, waiting 2 + 4 + 8 + 16 = 30s in
// between, with each connection attempt capped at 5s: about 55s at worst.
// The ECS health check grace period must cover this window (#33).
export const STARTUP_RETRY: RetryOptions = { attempts: 5, initialDelayMs: 2_000 };
const CONNECTION_TIMEOUT_MS = 5_000;

/**
 * The Prisma client as an injectable provider. Nest creates one instance per
 * process, checks the database at startup and closes the pool on shutdown,
 * e.g. when ECS stops a task during a deploy.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: createPrismaAdapter(config.get("DATABASE_URL", { infer: true }), {
        connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    // With a driver adapter, $connect() doesn't open a connection; the pool
    // connects on the first query. Run one now so an unreachable database
    // fails startup instead of the first request. Retrying rides out a brief
    // outage or a slow Neon cold start; a database that stays unreachable
    // (such as a wrong DATABASE_URL) still stops the task, so ECS fails the
    // deploy and rolls back.
    await retry(() => this.$queryRaw`SELECT 1`, {
      ...STARTUP_RETRY,
      onRetry: (err, attempt, delayMs) =>
        this.logger.warn(
          { err },
          `Database unreachable (attempt ${attempt} of ${STARTUP_RETRY.attempts}), retrying in ${delayMs / 1000}s`
        ),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
