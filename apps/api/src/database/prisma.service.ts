import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createPrismaAdapter, PrismaClient } from "@freshcast/db";
import type { Env } from "../config/env.schema.js";

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
  constructor(config: ConfigService<Env, true>) {
    super({ adapter: createPrismaAdapter(config.get("DATABASE_URL", { infer: true })) });
  }

  async onModuleInit(): Promise<void> {
    // With a driver adapter, $connect() doesn't open a connection; the pool
    // connects on the first query. Run one now so an unreachable database
    // fails startup instead of the first request.
    await this.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
