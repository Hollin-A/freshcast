import * as z from "zod";
import { errorResponse, getBusinessContext } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

const diagnosticsSchema = z.object({
  stage: z.enum(["presign", "s3-upload", "parse"]),
  status: z.number().int().min(0).max(999).optional(),
  statusText: z.string().max(200).optional(),
  bodySnippet: z.string().max(1000).optional(),
  uploadHost: z.string().max(200).optional(),
  fileName: z.string().max(255).optional(),
  fileType: z.string().max(100).optional(),
  fileSize: z.number().int().min(0).optional(),
  message: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const body = await request.json();
    const parsed = diagnosticsSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid diagnostics payload", 400);
    }

    logger.warn("receipts", "Client upload diagnostic", {
      businessId: ctx.businessId,
      ...parsed.data,
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    logger.error("receipts", "POST /api/receipts/upload-diagnostics failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
