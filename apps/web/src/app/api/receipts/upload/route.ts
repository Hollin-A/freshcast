import { randomUUID } from "node:crypto";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ok, errorResponse, getBusinessContext } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { getReceiptsBucket, getS3Client, isReceiptUploadEnabled, presignReceiptUpload } from "@/lib/s3";
import { rateLimit } from "@/lib/rate-limit";
import { receiptUploadSchema } from "@/schemas";
import { withRequestLogging } from "@/lib/request-logging";

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

async function handlePost(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    if (!isReceiptUploadEnabled()) {
      return errorResponse(
        "FEATURE_DISABLED",
        "Receipt upload is currently unavailable. Type your sales or use the product form instead.",
        503
      );
    }

    const { success: rateLimitOk } = rateLimit(`receipt-upload:${ctx.businessId}`, 20, 60 * 60 * 1000);
    if (!rateLimitOk) {
      return errorResponse("RATE_LIMITED", "Too many receipt uploads. Please try again later.", 429);
    }

    const bucket = getReceiptsBucket();
    if (!bucket) {
      return errorResponse("SERVICE_UNAVAILABLE", "Receipt upload is not configured", 503);
    }

    const body = await request.json();
    const result = receiptUploadSchema.safeParse(body);
    if (!result.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid upload request", 400, {
        fields: result.error.flatten().fieldErrors,
      });
    }

    const { fileName, contentType, fileSize } = result.data;
    if (!ALLOWED_CONTENT_TYPES.has(contentType.toLowerCase())) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Unsupported file type. Use JPEG, PNG, or WEBP.",
        400
      );
    }

    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `receipts/${ctx.businessId}/${Date.now()}-${randomUUID()}-${safeFileName}`;
    const s3 = getS3Client();

    const uploadUrl = await presignReceiptUpload({
      bucket,
      key,
      contentType,
      contentLength: fileSize,
      expiresIn: 60 * 5,
    });

    const previewUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn: 60 * 30 }
    );

    logger.info("receipts", "Generated upload URL", {
      businessId: ctx.businessId,
      key,
      contentType,
      fileSize,
    });

    return ok({
      key,
      uploadUrl,
      previewUrl,
      expiresInSeconds: 300,
    });
  } catch (err) {
    logger.error("receipts", "POST /api/receipts/upload failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}

export const POST = withRequestLogging(handlePost);
