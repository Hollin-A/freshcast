import { Body, Controller, Delete, Get, HttpCode, type INestApplication, Module, Param, Patch, Post } from "@nestjs/common";
import { createZodDto } from "nestjs-zod";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import type { SessionBusiness } from "../src/auth/auth-context.js";
import { CurrentBusiness, CurrentUser, type SessionUser } from "../src/auth/current-session.decorator.js";
import { ApiException } from "../src/common/api-exception.js";
import { Public } from "../src/common/public.decorator.js";
import { DatabaseModule } from "../src/database/database.module.js";
import { PrismaService } from "../src/database/prisma.service.js";
import { InjectScopedPrisma, type ScopedPrismaClient } from "../src/database/scoped-prisma.js";
import { type Fixtures, seedFixtures } from "./fixtures.js";
import { createE2eApp, resetDatabase, sessionCookie } from "./harness.js";

// Sessions against real users and businesses, and the scoped Prisma client
// they drive: a query never reaches another business's rows, even when it
// leaves businessId out (ADR-008, ADR-025).
//
// No business-owned route exists in the API yet, so a test-only controller
// stands in for one. Its queries deliberately leave out businessId; the
// scoped client adds it. Each slice (#36–#43) adds the same checks for its
// real routes.

class IdParamDto extends createZodDto(z.object({ id: z.string().min(1) })) {}
class RenameDto extends createZodDto(z.object({ name: z.string().min(1) })) {}
class ProductIdDto extends createZodDto(z.object({ productId: z.string().min(1) })) {}
class SalesEntryDto extends createZodDto(
  z.object({ items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().positive() })).min(1) })
) {}

@Controller("e2e-probe")
class ProbeController {
  constructor(@InjectScopedPrisma() private readonly db: ScopedPrismaClient) {}

  @Get("me")
  me(@CurrentUser() user: SessionUser, @CurrentBusiness() business: SessionBusiness) {
    return { userId: user.id, businessId: business.id };
  }

  @Get("business")
  async business() {
    return this.db.business.findFirstOrThrow({ select: { id: true, name: true } });
  }

  @Get("products")
  async products() {
    return this.db.product.findMany({ select: { id: true } });
  }

  @Get("products/:id")
  async product(@Param() { id }: IdParamDto) {
    const product = await this.db.product.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!product) throw notFound();
    return product;
  }

  @Patch("products/:id")
  @HttpCode(204)
  async rename(@Param() { id }: IdParamDto, @Body() { name }: RenameDto) {
    const { count } = await this.db.product.updateMany({ where: { id }, data: { name } });
    if (count === 0) throw notFound();
  }

  @Delete("products/:id")
  @HttpCode(204)
  async remove(@Param() { id }: IdParamDto) {
    const { count } = await this.db.product.deleteMany({ where: { id } });
    if (count === 0) throw notFound();
  }

  @Post("sales-entries")
  async createEntry(@CurrentBusiness() business: SessionBusiness, @Body() { items }: SalesEntryDto) {
    await this.db.$assertOwned(
      "product",
      items.map((i) => i.productId),
      "items"
    );
    return this.db.salesEntry.create({
      // Prisma's types require businessId on create; the scoped client
      // checks it is the session's.
      data: { businessId: business.id, date: new Date("2026-11-20"), items: { create: items } },
      select: { id: true, businessId: true },
    });
  }

  /** No $assertOwned(): the scoped client checks the stored productIds itself. */
  @Post("sales-entries/unchecked")
  async createEntryUnchecked(@CurrentBusiness() business: SessionBusiness, @Body() { items }: SalesEntryDto) {
    return this.db.salesEntry.create({
      data: { businessId: business.id, date: new Date("2026-11-20"), items: { create: items } },
      select: { id: true },
    });
  }

  /** The way an edit runs: ownership check and write in one transaction. */
  @Post("sales-entries/in-transaction")
  async createEntryInTransaction(@CurrentBusiness() business: SessionBusiness, @Body() { items }: SalesEntryDto) {
    return this.db.$transaction(async (tx) => {
      await tx.$assertOwned(
        "product",
        items.map((i) => i.productId),
        "items"
      );
      return tx.salesEntry.create({
        data: { businessId: business.id, date: new Date("2026-11-20"), items: { create: items } },
        select: { id: true },
      });
    });
  }

  @Patch("sales-items/product")
  async repointItems(@Body() { productId }: ProductIdDto) {
    return this.db.salesItem.updateMany({ data: { productId } });
  }

  @Get("business-owner")
  async businessOwner() {
    return this.db.business.findFirst({ include: { user: true } });
  }

  @Get("sales-items/count")
  async salesItemCount() {
    return { count: await this.db.salesItem.count() };
  }

  @Get("transaction")
  async transaction() {
    return this.db.$transaction(async (tx) => tx.product.findMany({ select: { id: true } }));
  }

  /** The types already forbid this; the cast checks the runtime guard too. */
  @Get("transaction-raw")
  async transactionRaw() {
    return this.db.$transaction(async (tx) =>
      (tx as unknown as { $queryRaw(sql: TemplateStringsArray): Promise<unknown> }).$queryRaw`SELECT id FROM "Product"`
    );
  }

  /** A mistake the scoped client must catch: a public route has no session. */
  @Public()
  @Get("public-products")
  async publicProducts() {
    return this.db.product.findMany({ select: { id: true } });
  }
}

@Module({ imports: [DatabaseModule], controllers: [ProbeController] })
class ProbeModule {}

function notFound(): ApiException {
  return new ApiException("NOT_FOUND", "Product not found.", 404);
}

describe("business isolation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fx: Fixtures;

  beforeAll(async () => {
    ({ app, prisma } = await createE2eApp({ imports: [ProbeModule] }));
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    fx = await seedFixtures(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  const http = () => request(app.getHttpServer());

  it("resolves each session to its own user and business", async () => {
    for (const owner of [fx.alpha, fx.beta]) {
      const res = await http().get("/e2e-probe/me").set("Cookie", owner.cookie).expect(200);
      expect(res.body).toEqual({ userId: owner.userId, businessId: owner.businessId });
    }
  });

  it("reads the session's own product", async () => {
    const res = await http()
      .get(`/e2e-probe/products/${fx.alpha.productId}`)
      .set("Cookie", fx.alpha.cookie)
      .expect(200);
    expect(res.body).toEqual({ id: fx.alpha.productId, name: "Tomatoes" });
  });

  it("answers 404 for another business's product", async () => {
    const res = await http()
      .get(`/e2e-probe/products/${fx.beta.productId}`)
      .set("Cookie", fx.alpha.cookie)
      .expect(404);
    expect(res.body).toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("can't change another business's product", async () => {
    await http()
      .patch(`/e2e-probe/products/${fx.beta.productId}`)
      .set("Cookie", fx.alpha.cookie)
      .send({ name: "Taken over" })
      .expect(404);

    const product = await prisma.product.findUniqueOrThrow({ where: { id: fx.beta.productId } });
    expect(product.name).toBe("Tomatoes");
  });

  it("lists only the session's own products", async () => {
    const res = await http().get("/e2e-probe/products").set("Cookie", fx.alpha.cookie).expect(200);
    expect(res.body).toEqual([{ id: fx.alpha.productId }]);
  });

  it("reads only the session's own business", async () => {
    const res = await http().get("/e2e-probe/business").set("Cookie", fx.beta.cookie).expect(200);
    expect(res.body).toEqual({ id: fx.beta.businessId, name: "beta Market" });
  });

  it("can't delete another business's product", async () => {
    await http().delete(`/e2e-probe/products/${fx.beta.productId}`).set("Cookie", fx.alpha.cookie).expect(404);
    await prisma.product.findUniqueOrThrow({ where: { id: fx.beta.productId } });
  });

  it("creates a sales entry for the session's business, with its items", async () => {
    const res = await http()
      .post("/e2e-probe/sales-entries")
      .set("Cookie", fx.alpha.cookie)
      .send({ items: [{ productId: fx.alpha.productId, quantity: 3 }] })
      .expect(201);
    expect(res.body.businessId).toBe(fx.alpha.businessId);
    await http().get("/e2e-probe/sales-items/count").set("Cookie", fx.alpha.cookie).expect(200, { count: 1 });
    await http().get("/e2e-probe/sales-items/count").set("Cookie", fx.beta.cookie).expect(200, { count: 0 });
  });

  it("rejects another business's product ID in the body, and writes nothing", async () => {
    const res = await http()
      .post("/e2e-probe/sales-entries")
      .set("Cookie", fx.alpha.cookie)
      .send({ items: [{ productId: fx.alpha.productId, quantity: 1 }, { productId: fx.beta.productId, quantity: 1 }] })
      .expect(400);
    expect(res.body).toMatchObject({
      code: "VALIDATION_ERROR",
      errors: { items: [`Unknown Product ID: ${fx.beta.productId}`] },
    });
    expect(await prisma.salesEntry.count()).toBe(0);
  });

  it("rejects another business's product ID even without $assertOwned()", async () => {
    const res = await http()
      .post("/e2e-probe/sales-entries/unchecked")
      .set("Cookie", fx.alpha.cookie)
      .send({ items: [{ productId: fx.beta.productId, quantity: 1 }] })
      .expect(400);
    expect(res.body).toMatchObject({
      code: "VALIDATION_ERROR",
      errors: { productId: [`Unknown Product ID: ${fx.beta.productId}`] },
    });
    expect(await prisma.salesEntry.count()).toBe(0);
  });

  it("checks product IDs with $assertOwned() inside a transaction", async () => {
    await http()
      .post("/e2e-probe/sales-entries/in-transaction")
      .set("Cookie", fx.alpha.cookie)
      .send({ items: [{ productId: fx.alpha.productId, quantity: 1 }] })
      .expect(201);
    const res = await http()
      .post("/e2e-probe/sales-entries/in-transaction")
      .set("Cookie", fx.alpha.cookie)
      .send({ items: [{ productId: fx.beta.productId, quantity: 1 }] })
      .expect(400);
    expect(res.body).toMatchObject({ errors: { items: [`Unknown Product ID: ${fx.beta.productId}`] } });
    expect(await prisma.salesEntry.count()).toBe(1);
  });

  it("can't point the session's sales items at another business's product", async () => {
    await http()
      .post("/e2e-probe/sales-entries")
      .set("Cookie", fx.alpha.cookie)
      .send({ items: [{ productId: fx.alpha.productId, quantity: 1 }] })
      .expect(201);
    await http()
      .patch("/e2e-probe/sales-items/product")
      .set("Cookie", fx.alpha.cookie)
      .send({ productId: fx.beta.productId })
      .expect(400);
    const items = await prisma.salesItem.findMany({ select: { productId: true } });
    expect(items).toEqual([{ productId: fx.alpha.productId }]);
  });

  it("refuses to read the auth tables through the business", async () => {
    await http().get("/e2e-probe/business-owner").set("Cookie", fx.alpha.cookie).expect(500);
  });

  it("scopes queries inside a transaction", async () => {
    const res = await http().get("/e2e-probe/transaction").set("Cookie", fx.alpha.cookie).expect(200);
    expect(res.body).toEqual([{ id: fx.alpha.productId }]);
  });

  it("refuses raw SQL, even on the transaction client", async () => {
    const res = await http().get("/e2e-probe/transaction-raw").set("Cookie", fx.alpha.cookie).expect(500);
    expect(res.body).toMatchObject({ code: "INTERNAL_ERROR" });
  });

  it("answers 403 BUSINESS_REQUIRED from the scoped client before onboarding", async () => {
    const res = await http().get("/e2e-probe/products").set("Cookie", fx.newcomer.cookie).expect(403);
    expect(res.body).toMatchObject({ code: "BUSINESS_REQUIRED" });
  });

  it("fails closed on a public route, where there is no business", async () => {
    await http().get("/e2e-probe/public-products").expect(500);
  });

  it("keeps concurrent requests to their own business", async () => {
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, i) => {
        const owner = i % 2 === 0 ? fx.alpha : fx.beta;
        return http()
          .get("/e2e-probe/products")
          .set("Cookie", owner.cookie)
          .then((res) => ({ owner, body: res.body }));
      })
    );
    for (const { owner, body } of responses) expect(body).toEqual([{ id: owner.productId }]);
  });

  it("answers 401 without a session", async () => {
    const res = await http().get("/e2e-probe/me").expect(401);
    expect(res.body).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("answers 401 once the user is deleted, though the cookie hasn't expired", async () => {
    await prisma.user.delete({ where: { id: fx.alpha.userId } });
    await http().get("/e2e-probe/me").set("Cookie", fx.alpha.cookie).expect(401);
  });

  it("answers 401 for a user ID that doesn't exist", async () => {
    await http().get("/e2e-probe/me").set("Cookie", await sessionCookie("no-such-user")).expect(401);
  });

  it("answers 403 BUSINESS_REQUIRED before onboarding", async () => {
    const res = await http().get("/e2e-probe/me").set("Cookie", fx.newcomer.cookie).expect(403);
    expect(res.body).toMatchObject({ code: "BUSINESS_REQUIRED" });
  });
});
