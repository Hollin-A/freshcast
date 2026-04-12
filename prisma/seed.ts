import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const DEMO_EMAIL = "demo@bizsense.app";
const DEMO_PASSWORD = "demo1234";

const PRODUCTS = [
  { name: "Eggs", defaultUnit: "pieces" },
  { name: "Minced beef", defaultUnit: "kg" },
  { name: "Chicken breast", defaultUnit: "kg" },
  { name: "Milk", defaultUnit: "liters" },
  { name: "Bread", defaultUnit: "pieces" },
  { name: "Lamb chops", defaultUnit: "kg" },
  { name: "Rice", defaultUnit: "kg" },
];

// Simulate realistic daily sales with weekday patterns
function generateQuantity(
  base: number,
  dayOfWeek: number,
  variance: number
): number {
  // Weekday multipliers: Mon=0.8, Tue=0.9, Wed=1.0, Thu=1.1, Fri=1.3, Sat=1.4, Sun=0.7
  const weekdayMultiplier = [0.7, 0.8, 0.9, 1.0, 1.1, 1.3, 1.4][dayOfWeek];
  const random = 1 + (Math.random() - 0.5) * variance;
  return Math.max(1, Math.round(base * weekdayMultiplier * random));
}

const PRODUCT_BASES: Record<string, number> = {
  Eggs: 25,
  "Minced beef": 15,
  "Chicken breast": 12,
  Milk: 20,
  Bread: 30,
  "Lamb chops": 8,
  Rice: 10,
};

async function main() {
  console.log("Seeding database...");

  // Clean existing demo data
  const existingUser = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
  });
  if (existingUser) {
    const existingBusiness = await prisma.business.findUnique({
      where: { userId: existingUser.id },
    });
    if (existingBusiness) {
      await prisma.dailyInsight.deleteMany({ where: { businessId: existingBusiness.id } });
      await prisma.demandForecast.deleteMany({ where: { businessId: existingBusiness.id } });
      const entries = await prisma.salesEntry.findMany({
        where: { businessId: existingBusiness.id },
        select: { id: true },
      });
      for (const entry of entries) {
        await prisma.salesItem.deleteMany({ where: { salesEntryId: entry.id } });
      }
      await prisma.salesEntry.deleteMany({ where: { businessId: existingBusiness.id } });
      await prisma.product.deleteMany({ where: { businessId: existingBusiness.id } });
      await prisma.business.delete({ where: { id: existingBusiness.id } });
    }
    await prisma.session.deleteMany({ where: { userId: existingUser.id } });
    await prisma.account.deleteMany({ where: { userId: existingUser.id } });
    await prisma.user.delete({ where: { id: existingUser.id } });
  }

  // Create demo user
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: "Demo User",
      passwordHash,
      emailVerified: new Date(),
    },
  });
  console.log(`Created user: ${user.email}`);

  // Create business
  const business = await prisma.business.create({
    data: {
      name: "Ali's Fresh Market",
      type: "MARKET_STALL",
      locale: "en",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      onboarded: true,
      userId: user.id,
    },
  });
  console.log(`Created business: ${business.name}`);

  // Create products
  const createdProducts = await Promise.all(
    PRODUCTS.map((p) =>
      prisma.product.create({
        data: { ...p, businessId: business.id },
      })
    )
  );
  console.log(`Created ${createdProducts.length} products`);

  // Generate 14 days of sales data
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const date = new Date(todayStr + "T00:00:00.000Z");
    date.setUTCDate(date.getUTCDate() - daysAgo);
    const dayOfWeek = date.getUTCDay();

    // Each day gets 1-2 entries
    const entryCount = Math.random() > 0.7 ? 2 : 1;

    for (let e = 0; e < entryCount; e++) {
      // Pick 3-6 random products per entry
      const shuffled = [...createdProducts].sort(() => Math.random() - 0.5);
      const selectedProducts = shuffled.slice(
        0,
        3 + Math.floor(Math.random() * 4)
      );

      const entry = await prisma.salesEntry.create({
        data: {
          date,
          inputMethod: Math.random() > 0.5 ? "NATURAL_LANGUAGE" : "MANUAL",
          rawInput:
            Math.random() > 0.5
              ? selectedProducts
                  .map(
                    (p) =>
                      `${generateQuantity(PRODUCT_BASES[p.name] || 10, dayOfWeek, 0.4)}${p.defaultUnit === "kg" ? "kg" : ""} ${p.name.toLowerCase()}`
                  )
                  .join(", ")
              : null,
          businessId: business.id,
          items: {
            create: selectedProducts.map((p) => ({
              productId: p.id,
              quantity: generateQuantity(
                PRODUCT_BASES[p.name] || 10,
                dayOfWeek,
                0.4
              ),
              unit: p.defaultUnit,
            })),
          },
        },
      });

      const dateLabel = date.toISOString().split("T")[0];
      console.log(
        `  ${dateLabel} entry ${e + 1}: ${selectedProducts.length} items`
      );
    }
  }

  console.log("\nSeed complete!");
  console.log(`Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
