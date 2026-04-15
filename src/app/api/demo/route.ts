import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, getBusinessContext } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

const DEMO_PRODUCTS = [
  { name: "Eggs", defaultUnit: "pieces" },
  { name: "Minced beef", defaultUnit: "kg" },
  { name: "Chicken breast", defaultUnit: "kg" },
  { name: "Milk", defaultUnit: "liters" },
  { name: "Bread", defaultUnit: "pieces" },
];

const PRODUCT_BASES: Record<string, number> = {
  Eggs: 25,
  "Minced beef": 15,
  "Chicken breast": 12,
  Milk: 20,
  Bread: 30,
};

function generateQuantity(base: number, dayOfWeek: number): number {
  const multiplier = [0.7, 0.8, 0.9, 1.0, 1.1, 1.3, 1.4][dayOfWeek];
  const random = 1 + (Math.random() - 0.5) * 0.4;
  return Math.max(1, Math.round(base * multiplier * random));
}

export async function POST() {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const { businessId } = ctx;

    // Only allow if no sales exist
    const existingCount = await prisma.salesEntry.count({ where: { businessId } });
    if (existingCount > 0) {
      return errorResponse("CONFLICT", "Demo data can only be loaded on an empty account", 409);
    }

    // Get or create demo products
    const existingProducts = await prisma.product.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, defaultUnit: true },
    });

    let products = existingProducts;
    if (products.length === 0) {
      products = await Promise.all(
        DEMO_PRODUCTS.map((p) =>
          prisma.product.create({
            data: { ...p, businessId },
            select: { id: true, name: true, defaultUnit: true },
          })
        )
      );
    }

    // Generate 14 days of sales
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
      const date = new Date(todayStr + "T00:00:00.000Z");
      date.setUTCDate(date.getUTCDate() - daysAgo);
      const dayOfWeek = date.getUTCDay();

      const shuffled = [...products].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, 3 + Math.floor(Math.random() * 3));

      await prisma.salesEntry.create({
        data: {
          date,
          inputMethod: "MANUAL",
          businessId,
          items: {
            create: selected.map((p) => ({
              productId: p.id,
              quantity: generateQuantity(PRODUCT_BASES[p.name] || 15, dayOfWeek),
              unit: p.defaultUnit,
            })),
          },
        },
      });
    }

    logger.info("demo", "Demo data loaded", { businessId });
    return NextResponse.json({ message: "Demo data loaded. Your dashboard is ready." }, { status: 201 });
  } catch (err) {
    logger.error("demo", "POST /api/demo failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
