import { Controller, Get, type INestApplication, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { encode } from "@auth/core/jwt";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HTTP_PIPELINE } from "../common/http-pipeline.js";
import { Public } from "../common/public.decorator.js";
import { PrismaService } from "../database/prisma.service.js";
import type { SessionBusiness } from "./auth-context.js";
import { CurrentBusiness, CurrentUser, type SessionUser } from "./current-session.decorator.js";
import { SessionCookieReader } from "./session-cookie.js";
import { SessionGuard } from "./session.guard.js";

// SessionGuard and the session decorators against cookies made by Auth.js's
// own encode(), the same way the App's next-auth makes them. The database is
// a stub; cross-business isolation against a real database is #31.

const SECRET = "test-secret-at-least-32-characters-long";
const DEV_COOKIE = "authjs.session-token";
const SECURE_COOKIE = "__Secure-authjs.session-token";

const BUSINESS: SessionBusiness = { id: "biz_1", timezone: "Australia/Melbourne", region: "AU-VIC" };
const USERS: Record<string, { id: string; business: SessionBusiness | null }> = {
  user_1: { id: "user_1", business: BUSINESS },
  user_new: { id: "user_new", business: null },
};

const findUnique = vi.fn(async ({ where }: { where: { id: string } }) => USERS[where.id] ?? null);

@Controller("test")
class TestController {
  @Public()
  @Get("public")
  open() {
    return { ok: true };
  }

  @Get("user")
  user(@CurrentUser() user: SessionUser) {
    return user;
  }

  @Get("business")
  business(@CurrentBusiness() business: SessionBusiness) {
    return business;
  }
}

function sessionCookie(
  claims: Record<string, unknown>,
  { name = DEV_COOKIE, secret = SECRET, maxAge }: { name?: string; secret?: string; maxAge?: number } = {}
) {
  return encode({ token: claims, secret, salt: name, maxAge }).then((token) => `${name}=${token}`);
}

async function createApp(nodeEnv: string): Promise<INestApplication> {
  const env: Record<string, string> = { AUTH_SECRET: SECRET, NODE_ENV: nodeEnv };

  @Module({
    controllers: [TestController],
    providers: [
      ...HTTP_PIPELINE,
      SessionCookieReader,
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: PrismaService, useValue: { user: { findUnique } } },
      { provide: ConfigService, useValue: { get: (key: string) => env[key] } },
    ],
  })
  class TestAppModule {}

  const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  return app;
}

describe("SessionGuard", () => {
  let app: INestApplication;
  const get = (path: string, cookie?: string) => {
    const req = request(app.getHttpServer()).get(path);
    return cookie ? req.set("Cookie", cookie) : req;
  };

  beforeAll(async () => {
    app = await createApp("development");
  });

  afterAll(() => app.close());

  beforeEach(() => {
    findUnique.mockClear();
  });

  it("lets @Public() routes through without a session", async () => {
    await get("/test/public").expect(200, { ok: true });
  });

  it("answers 401 Problem Details without a session cookie", async () => {
    const res = await get("/test/user").expect(401).expect("content-type", /^application\/problem\+json/);
    expect(res.body).toEqual({
      type: "https://api.freshcast.site/problems/unauthorized",
      title: "Unauthorized",
      status: 401,
      detail: "Sign in to continue.",
      code: "UNAUTHORIZED",
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("resolves the user and business from a valid cookie", async () => {
    const cookie = await sessionCookie({ id: "user_1", sub: "user_1" });
    await get("/test/user", cookie).expect(200, { id: "user_1" });
    await get("/test/business", cookie).expect(200, BUSINESS);
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user_1" } }));
  });

  it("finds the cookie among the browser's other cookies", async () => {
    const cookie = await sessionCookie({ id: "user_1" });
    await get("/test/user", `theme=dark; ${cookie}; NEXT_LOCALE=en`).expect(200, { id: "user_1" });
  });

  it.each([
    ["a tampered cookie", async () => `${await sessionCookie({ id: "user_1" })}x`],
    ["a cookie encrypted with another secret", () => sessionCookie({ id: "user_1" }, { secret: "x".repeat(32) })],
    ["an expired cookie", () => sessionCookie({ id: "user_1" }, { maxAge: -60 })],
    ["a cookie without a user ID", () => sessionCookie({ sub: "user_1" })],
    ["the HTTPS cookie outside production", () => sessionCookie({ id: "user_1" }, { name: SECURE_COOKIE })],
    ["a cookie value that isn't a JWE", async () => `${DEV_COOKIE}=not-a-token`],
  ])("answers 401 for %s", async (_name, makeCookie) => {
    const res = await get("/test/user", await makeCookie()).expect(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("answers 401 when the user no longer exists", async () => {
    const res = await get("/test/user", await sessionCookie({ id: "user_deleted" })).expect(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("answers 403 BUSINESS_REQUIRED before onboarding, but still knows the user", async () => {
    const cookie = await sessionCookie({ id: "user_new" });
    await get("/test/user", cookie).expect(200, { id: "user_new" });
    const res = await get("/test/business", cookie).expect(403);
    expect(res.body).toMatchObject({ status: 403, code: "BUSINESS_REQUIRED" });
  });

  it("takes the business from the session, never from the request", async () => {
    const cookie = await sessionCookie({ id: "user_1" });
    const res = await get("/test/business?businessId=biz_other", cookie).set("x-business-id", "biz_other");
    expect(res.body.id).toBe("biz_1");
  });
});

describe("SessionGuard in production", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp("production");
  });

  afterAll(() => app.close());

  it("reads the __Secure- cookie the App sets over HTTPS", async () => {
    const cookie = await sessionCookie({ id: "user_1" }, { name: SECURE_COOKIE });
    await request(app.getHttpServer()).get("/test/user").set("Cookie", cookie).expect(200, { id: "user_1" });
  });

  it("ignores the plain cookie name", async () => {
    const cookie = await sessionCookie({ id: "user_1" });
    await request(app.getHttpServer()).get("/test/user").set("Cookie", cookie).expect(401);
  });
});
