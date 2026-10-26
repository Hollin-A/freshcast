import { Writable } from "node:stream";
import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { TerminusModule } from "@nestjs/terminus";
import { LoggerModule, Logger as PinoLogger } from "nestjs-pino";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  healthLiveSchema,
  healthReadySchema,
  healthUnavailableSchema,
} from "@freshcast/shared";
import { HTTP_PIPELINE } from "../common/http-pipeline.js";
import { IS_PUBLIC_KEY } from "../common/public.decorator.js";
import { PrismaService } from "../database/prisma.service.js";
import { pinoParams } from "../logging/logging.module.js";
import { HealthController } from "./health.controller.js";

// The health endpoints with the real pipeline and logger, and a fake Prisma
// client whose SELECT 1 can be made to fail.

const prisma = {
  // Terminus tries the MongoDB ping first and falls back to SELECT 1 on
  // this error, which is what Prisma throws for Postgres.
  $runCommandRaw: vi.fn().mockRejectedValue(new Error("Use the mongodb provider")),
  $queryRawUnsafe: vi.fn(),
};

const lines: Record<string, unknown>[] = [];
const sink = new Writable({
  write(chunk: Buffer, _encoding, done) {
    for (const line of chunk.toString().split("\n").filter(Boolean)) lines.push(JSON.parse(line));
    done();
  },
});

describe("health endpoints", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TerminusModule.forRoot({ logger: false }), LoggerModule.forRoot(pinoParams("production", sink))],
      controllers: [HealthController],
      providers: [
        ...HTTP_PIPELINE,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => "abc1234" } },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(PinoLogger));
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    lines.length = 0;
    prisma.$queryRawUnsafe.mockReset().mockResolvedValue([{ "?column?": 1 }]);
  });

  it("is public", () => {
    expect(new Reflector().get(IS_PUBLIC_KEY, HealthController)).toBe(true);
  });

  describe("GET /health/live", () => {
    it("returns the version and uptime", async () => {
      const res = await request(app.getHttpServer()).get("/health/live").expect(200);
      expect(healthLiveSchema.parse(res.body)).toEqual({
        status: "ok",
        version: "abc1234",
        uptimeSeconds: expect.any(Number),
      });
    });

    it("returns 200 while the database is down", async () => {
      prisma.$queryRawUnsafe.mockRejectedValue(new Error("connect ECONNREFUSED"));
      await request(app.getHttpServer()).get("/health/live").expect(200);
      expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it("writes no request log line", async () => {
      await request(app.getHttpServer()).get("/health/live").expect(200);
      expect(lines.filter((l) => l.message === "request completed")).toEqual([]);
    });
  });

  describe("GET /health/ready", () => {
    it("returns 200 when the database answers", async () => {
      const res = await request(app.getHttpServer()).get("/health/ready").expect(200);
      expect(healthReadySchema.parse(res.body)).toEqual({
        status: "ok",
        checks: { database: { status: "up" } },
      });
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith("SELECT 1");
    });

    it("returns 503 Problem Details when the database is down", async () => {
      prisma.$queryRawUnsafe.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1:5432"));
      const res = await request(app.getHttpServer())
        .get("/health/ready")
        .expect(503)
        .expect("content-type", /^application\/problem\+json/);
      expect(healthUnavailableSchema.parse(res.body)).toEqual({
        type: "https://api.freshcast.site/problems/service-unavailable",
        title: "Service unavailable",
        status: 503,
        detail: "A dependency is unavailable",
        code: "SERVICE_UNAVAILABLE",
        checks: { database: { status: "down" } },
      });
      expect(JSON.stringify(res.body)).not.toContain("ECONNREFUSED");
      const logged = lines.find((l) => l.message === "Readiness check failed");
      expect(JSON.stringify(logged)).toContain("ECONNREFUSED");
    });
  });
});
