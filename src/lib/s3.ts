import { S3Client } from "@aws-sdk/client-s3";
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
