import type { PrismaService } from "../src/database/prisma.service.js";
import { sessionCookie } from "./harness.js";

// Two onboarded businesses for isolation tests: every e2e test of a
// business-owned route signs in as one and checks it can't read or change
// the other's rows. Add to a business's data here when a slice needs it.

export interface BusinessFixture {
  userId: string;
  businessId: string;
  productId: string;
  /** `Cookie` header value for this business's owner. */
  cookie: string;
}

export interface Fixtures {
  alpha: BusinessFixture;
  beta: BusinessFixture;
  /** Signed in, but hasn't finished onboarding, so has no business. */
  newcomer: { userId: string; cookie: string };
}

async function seedBusiness(prisma: PrismaService, key: string, timezone: string): Promise<BusinessFixture> {
  const user = await prisma.user.create({
    data: {
      email: `${key}@example.com`,
      name: `${key} owner`,
      emailVerified: new Date(),
      business: {
        create: {
          name: `${key} Market`,
          type: "PRODUCE_SELLER",
          timezone,
          onboarded: true,
          products: { create: { name: "Tomatoes", defaultUnit: "kg" } },
        },
      },
    },
    select: { id: true, business: { select: { id: true, products: { select: { id: true } } } } },
  });
  const business = user.business!;
  return {
    userId: user.id,
    businessId: business.id,
    productId: business.products[0]!.id,
    cookie: await sessionCookie(user.id),
  };
}

export async function seedFixtures(prisma: PrismaService): Promise<Fixtures> {
  const alpha = await seedBusiness(prisma, "alpha", "Australia/Melbourne");
  const beta = await seedBusiness(prisma, "beta", "Australia/Perth");
  const newcomer = await prisma.user.create({
    data: { email: "newcomer@example.com", name: "New owner" },
    select: { id: true },
  });
  return { alpha, beta, newcomer: { userId: newcomer.id, cookie: await sessionCookie(newcomer.id) } };
}
