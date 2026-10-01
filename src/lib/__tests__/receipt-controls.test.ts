import { afterEach, describe, expect, it, vi } from "vitest";
import { receiptUploadSchema } from "@/schemas";
import { RECEIPT_MAX_UPLOAD_BYTES } from "../constants";

// s3.ts caches its client, so each test loads a fresh copy after setting env.
async function loadS3(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import("../s3");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isReceiptUploadEnabled", () => {
  it("is off unless RECEIPT_UPLOAD_ENABLED is exactly 'true'", async () => {
    expect((await loadS3({})).isReceiptUploadEnabled()).toBe(false);
    expect((await loadS3({ RECEIPT_UPLOAD_ENABLED: "1" })).isReceiptUploadEnabled()).toBe(false);
    expect((await loadS3({ RECEIPT_UPLOAD_ENABLED: "false" })).isReceiptUploadEnabled()).toBe(false);
    expect((await loadS3({ RECEIPT_UPLOAD_ENABLED: "true" })).isReceiptUploadEnabled()).toBe(true);
  });
});

describe("presignReceiptUpload", () => {
  it("signs Content-Length so S3 rejects uploads of a different size", async () => {
    // Dummy credentials: signing happens locally, no request is sent.
    const { presignReceiptUpload } = await loadS3({
      APP_AWS_REGION: "ap-southeast-2",
      APP_AWS_ACCESS_KEY_ID: "AKIATESTTESTTESTTEST",
      APP_AWS_SECRET_ACCESS_KEY: "test-secret",
    });

    const url = new URL(
      await presignReceiptUpload({
        bucket: "test-bucket",
        key: "receipts/b1/r.jpg",
        contentType: "image/jpeg",
        contentLength: 12345,
        expiresIn: 300,
      })
    );

    const signedHeaders = url.searchParams.get("X-Amz-SignedHeaders")?.split(";") ?? [];
    expect(signedHeaders).toContain("content-length");
    expect(signedHeaders).toContain("content-type");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
  });
});

describe("receiptUploadSchema", () => {
  const base = { fileName: "r.jpg", contentType: "image/jpeg" };

  it("accepts a file at the size cap", () => {
    expect(receiptUploadSchema.safeParse({ ...base, fileSize: RECEIPT_MAX_UPLOAD_BYTES }).success).toBe(true);
  });

  it("rejects files over the cap, empty files and a missing size", () => {
    const over = receiptUploadSchema.safeParse({ ...base, fileSize: RECEIPT_MAX_UPLOAD_BYTES + 1 });
    expect(over.success).toBe(false);
    expect(over.error?.issues[0].message).toBe("Receipt image must be 10 MB or smaller");
    expect(receiptUploadSchema.safeParse({ ...base, fileSize: 0 }).success).toBe(false);
    expect(receiptUploadSchema.safeParse(base).success).toBe(false);
  });
});
