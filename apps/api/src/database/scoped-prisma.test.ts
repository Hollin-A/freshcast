import { createPrismaClient } from "@freshcast/db";
import { ClsServiceManager, type ClsService } from "nestjs-cls";
import { afterAll, describe, expect, it } from "vitest";
import { ApiException } from "../common/api-exception.js";
import { currentBusinessId, type RequestContext } from "./business-context.js";
import { ScopeViolationError } from "./business-scope.js";
import { createScopedClient } from "./scoped-prisma.js";

// The parts of the scoped client that need no database: which methods it
// exposes and where the Business comes from. Its queries run against a real
// database in test/isolation.e2e-spec.ts.

// Never connects: no test here sends a query.
const prisma = createPrismaClient("postgresql://unused:unused@127.0.0.1:1/unused");
afterAll(() => prisma.$disconnect());

describe("createScopedClient", () => {
  const db = createScopedClient(prisma, () => "biz_alpha");

  it.each(["$queryRaw", "$queryRawUnsafe", "$executeRaw", "$executeRawUnsafe", "$queryRawTyped", "$extends", "$connect", "$disconnect", "$on"])(
    "hides %s",
    (method) => {
      expect(() => (db as unknown as Record<string, unknown>)[method]).toThrow(ScopeViolationError);
    }
  );

  it.each(["user", "account", "session", "verificationToken"])("hides the auth table %s", (delegate) => {
    expect(() => (db as unknown as Record<string, unknown>)[delegate]).toThrow(ScopeViolationError);
  });

  it.each(["onModuleInit", "onModuleDestroy", "then", "constructor"])("reads %s as undefined", (prop) => {
    // Nest calls lifecycle hooks on any provider that has them, and awaits
    // anything with a `then`; the scoped client must look like neither.
    expect((db as unknown as Record<string, unknown>)[prop]).toBeUndefined();
  });

  it("exposes the model delegates, $transaction and $assertOwned", () => {
    expect(db.product).toBeDefined();
    expect(db.salesEntry).toBeDefined();
    expect(typeof db.$transaction).toBe("function");
    expect(typeof db.$assertOwned).toBe("function");
  });

  it("accepts an empty ID list without querying", async () => {
    await expect(db.$assertOwned("product", [])).resolves.toBeUndefined();
  });
});

describe("currentBusinessId", () => {
  const cls = ClsServiceManager.getClsService() as ClsService<RequestContext>;

  it("reads the Business SessionGuard put in the request context", () => {
    const id = cls.run(() => {
      cls.set("businessId", "biz_alpha");
      return currentBusinessId(cls);
    });
    expect(id).toBe("biz_alpha");
  });

  it("answers 403 BUSINESS_REQUIRED for a session before onboarding", () => {
    const run = () =>
      cls.run(() => {
        cls.set("userId", "user_new");
        return currentBusinessId(cls);
      });
    expect(run).toThrow(ApiException);
    expect(run).toThrow(expect.objectContaining({ code: "BUSINESS_REQUIRED", status: 403 }));
  });

  it("throws in a request without a session, such as on a public route", () => {
    expect(() => cls.run(() => currentBusinessId(cls))).toThrow(ScopeViolationError);
  });

  it("throws outside any request, such as in a job", () => {
    expect(() => currentBusinessId(cls)).toThrow(ScopeViolationError);
  });

  it("keeps each request's Business apart", async () => {
    const inRequest = (businessId: string) =>
      cls.run(async () => {
        cls.set("businessId", businessId);
        await new Promise((resolve) => setTimeout(resolve, 5));
        return currentBusinessId(cls);
      });
    await expect(Promise.all([inRequest("biz_alpha"), inRequest("biz_beta")])).resolves.toEqual(["biz_alpha", "biz_beta"]);
  });
});
