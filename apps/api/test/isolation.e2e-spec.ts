import { Body, Controller, Get, HttpCode, type INestApplication, Module, Param, Patch } from "@nestjs/common";
import { createZodDto } from "nestjs-zod";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import type { SessionBusiness } from "../src/auth/auth-context.js";
import { CurrentBusiness, CurrentUser, type SessionUser } from "../src/auth/current-session.decorator.js";
import { ApiException } from "../src/common/api-exception.js";
import { DatabaseModule } from "../src/database/database.module.js";
import { PrismaService } from "../src/database/prisma.service.js";
import { type Fixtures, seedFixtures } from "./fixtures.js";
import { createE2eApp, resetDatabase, sessionCookie } from "./harness.js";

// Sessions against real users and businesses: the cookie the App issues
// resolves to its own user's business and nothing else (ADR-008).
//
// No business-owned route exists in the API yet, so a test-only controller
// stands in for one, written the way Stage 4 handlers are: the business
// comes from @CurrentBusiness(), never from the request, and another
// business's IDs answer 404. Each slice (#36–#43) adds the same checks for
// its real routes; #127 then enforces the scoping in the Prisma client.

class IdParamDto extends createZodDto(z.object({ id: z.string().min(1) })) {}
class RenameDto extends createZodDto(z.object({ name: z.string().min(1) })) {}

@Controller("e2e-probe")
class ProbeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("me")
  me(@CurrentUser() user: SessionUser, @CurrentBusiness() business: SessionBusiness) {
    return { userId: user.id, businessId: business.id };
  }

  @Get("products/:id")
  async product(@CurrentBusiness() business: SessionBusiness, @Param() { id }: IdParamDto) {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId: business.id },
      select: { id: true, name: true },
    });
    if (!product) throw notFound();
    return product;
  }

  @Patch("products/:id")
  @HttpCode(204)
  async rename(@CurrentBusiness() business: SessionBusiness, @Param() { id }: IdParamDto, @Body() { name }: RenameDto) {
    const { count } = await this.prisma.product.updateMany({ where: { id, businessId: business.id }, data: { name } });
    if (count === 0) throw notFound();
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
