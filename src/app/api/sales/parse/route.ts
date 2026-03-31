import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, getBusinessId } from "@/lib/api-helpers";
import { parseSalesInput } from "@/services/sales-parser";

const parseSchema = z.object({
  text: z.string().min(1).max(1000),
});

export async function POST(request: Request) {
  try {
    const businessId = await getBusinessId();
    if (!businessId) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const body = await request.json();
    const result = parseSchema.safeParse(body);

    if (!result.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid input", 400);
    }

    const products = await prisma.product.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, defaultUnit: true },
    });

    const parsed = parseSalesInput(result.data.text, products);

    return NextResponse.json(parsed);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
