import { Controller, Get, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import { ClsModule } from "nestjs-cls";
import { LoggerModule } from "nestjs-pino";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionBusiness } from "../auth/auth-context.js";
import { SessionCookieReader } from "../auth/session-cookie.js";
import { HTTP_PIPELINE } from "../common/http-pipeline.js";
import { Public } from "../common/public.decorator.js";
import { PrismaService } from "../database/prisma.service.js";
import { SCOPED_PRISMA } from "../database/scoped-prisma.js";
import { GuardsModule } from "../guards/guards.module.js";
import { CLIENT_IP_HEADER, PROXY_SECRET_HEADER } from "./client-ip.js";
import { trustProxy } from "./rate-limit.module.js";
import { RateLimit, RATE_LIMITS } from "./rate-limits.js";

// The real GuardsModule, so the tests also cover RequestGuard running
// SessionGuard first. The session cookie and database are stubbed: the
// x-test-user header names the signed-in user.

const PROXY_SECRET = "test-proxy-secret-at-least-32-characters";

const USERS: Record<string, { id: string; business: SessionBusiness | null }> = {
  alice: { id: "alice", business: { id: "biz_a", timezone: "UTC", region: "AU-VIC" } },
  alice_colleague: { id: "alice_colleague", business: { id: "biz_a", timezone: "UTC", region: "AU-VIC" } },
  bob: { id: "bob", business: { id: "biz_b", timezone: "UTC", region: "AU-VIC" } },
  newbie: { id: "newbie", business: null },
};

@Controller("test")
class TestController {
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  @Get("tight")
  tight() {
    return { ok: true };
  }

  @Get("other")
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  other() {
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  @Get("public")
  open() {
    return { ok: true };
  }

  @RateLimit("costly")
  @Get("costly")
  costly() {
    return { ok: true };
  }

  @Get("standard")
  standard() {
    return { ok: true };
  }

  @SkipThrottle()
  @Throttle({ default: { limit: 1, ttl: 60_000 } })
  @Get("skipped")
  skipped() {
    return { ok: true };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({ PROXY_SECRET })] }),
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    // SessionGuard tags log lines with the Business.
    LoggerModule.forRoot({ pinoHttp: { level: "silent" } }),
    GuardsModule,
  ],
  controllers: [TestController],
  providers: [...HTTP_PIPELINE],
})
class TestAppModule {}

async function createApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] })
    .overrideProvider(SessionCookieReader)
    .useValue({ userId: async (headers: Record<string, unknown>) => headers["x-test-user"] ?? null })
    .overrideProvider(PrismaService)
    .useValue({
      user: { findUnique: async ({ where }: { where: { id: string } }) => USERS[where.id] ?? null },
    })
    .overrideProvider(SCOPED_PRISMA)
    .useValue({})
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  trustProxy(app);
  await app.init();
  return app;
}

// Each test gets a fresh app, so counts never carry over.
let app: NestExpressApplication;
afterEach(async () => {
  vi.useRealTimers();
  await app?.close();
});

const get = (path: string, user?: string, ip?: string, headers: Record<string, string> = {}) => {
  const req = request(app.getHttpServer()).get(path).set(headers);
  if (user) req.set("x-test-user", user);
  if (ip) req.set("x-forwarded-for", ip);
  return req;
};

// A request through the App's proxy: the ALB sees the App's address.
const viaProxy = (path: string, browserIp: string, secret = PROXY_SECRET) =>
  get(path, undefined, "192.0.2.10", { [PROXY_SECRET_HEADER]: secret, [CLIENT_IP_HEADER]: browserIp });

describe("RateLimitGuard", () => {
  it("answers 429 Problem Details with Retry-After once the limit is used up", async () => {
    app = await createApp();
    await get("/test/tight", "alice").expect(200).expect("x-ratelimit-remaining", "1");
    await get("/test/tight", "alice").expect(200).expect("x-ratelimit-remaining", "0");

    const res = await get("/test/tight", "alice")
      .expect(429)
      .expect("content-type", /^application\/problem\+json/);
    expect(res.body).toEqual({
      type: "https://api.freshcast.site/problems/rate-limited",
      title: "Rate limited",
      status: 429,
      detail: expect.stringMatching(/^Too many requests\. Try again in \d+ seconds?\.$/),
      code: "RATE_LIMITED",
    });
    const retryAfter = Number(res.headers["retry-after"]);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it("counts per business: two businesses don't share a limit", async () => {
    app = await createApp();
    await get("/test/tight", "alice").expect(200);
    await get("/test/tight", "alice").expect(200);
    await get("/test/tight", "alice").expect(429);

    await get("/test/tight", "bob").expect(200);
  });

  it("shares one allowance between users of the same business", async () => {
    app = await createApp();
    await get("/test/tight", "alice").expect(200);
    await get("/test/tight", "alice_colleague").expect(200);
    await get("/test/tight", "alice").expect(429);
  });

  it("ignores the client IP when signed in", async () => {
    app = await createApp();
    await get("/test/tight", "alice", "203.0.113.1").expect(200);
    await get("/test/tight", "alice", "203.0.113.2").expect(200);
    await get("/test/tight", "alice", "203.0.113.3").expect(429);
  });

  it("counts users without a business per user", async () => {
    app = await createApp();
    await get("/test/tight", "newbie").expect(200);
    await get("/test/tight", "newbie").expect(200);
    await get("/test/tight", "newbie").expect(429);
    await get("/test/tight", "alice").expect(200);
  });

  it("limits anonymous clients per IP from the ALB's X-Forwarded-For entry", async () => {
    app = await createApp();
    await get("/test/public", undefined, "203.0.113.1").expect(200);
    await get("/test/public", undefined, "203.0.113.1").expect(200);
    await get("/test/public", undefined, "203.0.113.1").expect(429);

    await get("/test/public", undefined, "203.0.113.2").expect(200);
    // A spoofed entry to the left of the ALB's doesn't get a fresh allowance.
    await get("/test/public", undefined, "198.51.100.9, 203.0.113.1").expect(429);
  });

  it("limits clients behind the App's proxy per browser IP", async () => {
    app = await createApp();
    await viaProxy("/test/public", "203.0.113.1").expect(200);
    await viaProxy("/test/public", "203.0.113.1").expect(200);
    await viaProxy("/test/public", "203.0.113.1").expect(429);

    // Same App address, another browser: its own allowance.
    await viaProxy("/test/public", "203.0.113.2").expect(200);
  });

  it("ignores the client IP header without the proxy secret", async () => {
    app = await createApp();
    await viaProxy("/test/public", "203.0.113.1", "wrong-secret").expect(200);
    await viaProxy("/test/public", "203.0.113.2", "wrong-secret").expect(200);
    // Both counted under the App's address, so a forged header buys nothing.
    await viaProxy("/test/public", "203.0.113.3", "wrong-secret").expect(429);
  });

  it("keeps a separate count per route", async () => {
    app = await createApp();
    await get("/test/tight", "alice").expect(200);
    await get("/test/tight", "alice").expect(200);
    await get("/test/tight", "alice").expect(429);
    await get("/test/other", "alice").expect(200);
  });

  it("counts requests SessionGuard rejects, per IP", async () => {
    app = await createApp();
    await get("/test/tight", undefined, "203.0.113.1").expect(401);
    await get("/test/tight", undefined, "203.0.113.1").expect(401);
    await get("/test/tight", undefined, "203.0.113.1").expect(429);

    await get("/test/tight", undefined, "203.0.113.2").expect(401);
    // Signed-in users of the route keep their own allowance.
    await get("/test/tight", "alice", "203.0.113.1").expect(200);
  });

  it("slides the window: refuses only until the oldest request expires", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = new Date("2026-01-01T10:00:00Z").getTime();
    vi.setSystemTime(start);
    app = await createApp();

    for (let i = 0; i < RATE_LIMITS.costly.limit - 1; i++) {
      await get("/test/costly", "alice").expect(200);
    }
    vi.setSystemTime(start + 59 * 60_000);
    await get("/test/costly", "alice").expect(200);

    const res = await get("/test/costly", "alice").expect(429);
    // Until 11:00, when the first requests expire, not an hour from now.
    expect(Number(res.headers["retry-after"])).toBe(60);

    vi.setSystemTime(start + 60 * 60_000 + 1_000);
    await get("/test/costly", "alice").expect(200);
  });

  it("applies the standard limit by default and the costly one where declared", async () => {
    app = await createApp();
    await get("/test/standard", "alice")
      .expect(200)
      .expect("x-ratelimit-limit", String(RATE_LIMITS.standard.limit));

    for (let i = 0; i < RATE_LIMITS.costly.limit; i++) {
      await get("/test/costly", "alice").expect(200);
    }
    const res = await get("/test/costly", "alice").expect(429);
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(3_000);
  });

  it("never limits @SkipThrottle() routes", async () => {
    app = await createApp();
    for (let i = 0; i < 3; i++) await get("/test/skipped", "alice").expect(200);
  });
});
