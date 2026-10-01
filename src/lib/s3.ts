import "server-only";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getAwsRuntimeConfig } from "./aws-config";

let client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!client) {
    client = new S3Client(getAwsRuntimeConfig());
  }
  return client;
}

export function getReceiptsBucket(): string | null {
  return process.env.S3_RECEIPTS_BUCKET || null;
}

/**
 * Receipt photo upload and parsing are off unless RECEIPT_UPLOAD_ENABLED is
 * "true". Receipt parsing calls billed services (Textract and Claude), so the
 * default is off; see ADR-019.
 */
export function isReceiptUploadEnabled(): boolean {
  return process.env.RECEIPT_UPLOAD_ENABLED === "true";
}

/**
 * Presigned PUT URL for one receipt image. Content-Length is part of the
 * signature, so S3 rejects an upload whose size differs from `contentLength`.
 */
export function presignReceiptUpload(params: {
  bucket: string;
  key: string;
  contentType: string;
  contentLength: number;
  expiresIn: number;
}): Promise<string> {
  return getSignedUrl(
    getS3Client(),
    new PutObjectCommand({
      Bucket: params.bucket,
      Key: params.key,
      ContentType: params.contentType,
      ContentLength: params.contentLength,
    }),
    { expiresIn: params.expiresIn, signableHeaders: new Set(["content-length", "content-type"]) }
  );
}
