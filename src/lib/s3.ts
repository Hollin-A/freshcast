import { S3Client } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: process.env.AWS_REGION || "ap-southeast-2",
    });
  }
  return client;
}

export function getReceiptsBucket(): string | null {
  return process.env.S3_RECEIPTS_BUCKET || null;
}
