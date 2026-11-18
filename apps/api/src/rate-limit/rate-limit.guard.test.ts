import { Controller, Get, Module } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import type { SessionBusiness } from "../auth/auth-context.js";
import { AuthModule } from "../auth/auth.module.js";
import { SessionCookieReader } from "../auth/session-cookie.js";
import { HTTP_PIPELINE } from "../common/http-pipeline.js";
import { Public } from "../common/public.decorator.js";
import { PrismaService } from "../database/prisma.service.js";
import { RateLimitModule, trustProxy } from "./rate-limit.module.js";
import { RateLimit, RATE_LIMITS } from "./rate-limits.js";

// The real AuthModule and RateLimitModule, imported in AppModule's order, so
// the tests also cover SessionGuard running first. The session cookie and
// database are stubbed: the x-test-user header names the signed-in user.

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
  imports: [AuthModule, RateLimitModule],
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
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  trustProxy(app);
  await app.init();
  return app;
}

// Each test gets a fresh app, so counts never carry over.
let app: NestExpressApplication;
afterEach(() => app?.close());

const get = (path: string, user?: string, ip?: string) => {
  const req = request(app.getHttpServer()).get(path);
  if (user) req.set("x-test-user", user);
  if (ip) req.set("x-forwarded-for", ip);
  return req;
};

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

  it("keeps a separate count per route", async () => {
    app = await createApp();
    await get("/test/tight", "alice").expect(200);
    await get("/test/tight", "alice").expect(200);
    await get("/test/tight", "alice").expect(429);
    await get("/test/other", "alice").expect(200);
  });

  it("doesn't count requests SessionGuard rejects", async () => {
    app = await createApp();
    for (let i = 0; i < 3; i++) await get("/test/tight").expect(401);
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
