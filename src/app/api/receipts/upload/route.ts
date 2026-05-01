import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import * as z from "zod";
import {
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { errorResponse, getBusinessContext } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { getReceiptsBucket, getS3Client } from "@/lib/s3";

const uploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
});

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const bucket = getReceiptsBucket();
    if (!bucket) {
      logger.warn("receipts", "Receipt upload not configured", {
        hasS3ReceiptsBucket: Boolean(process.env.S3_RECEIPTS_BUCKET),
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV ?? null,
      });
      return errorResponse("SERVICE_UNAVAILABLE", "Receipt upload is not configured", 503);
    }

    const body = await request.json();
    const result = uploadSchema.safeParse(body);
    if (!result.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid upload request", 400);
    }

    const { fileName, contentType } = result.data;
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

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: 60 * 5 }
    );

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
    });

    return NextResponse.json({
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
