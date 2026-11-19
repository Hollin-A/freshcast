import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createE2eApp } from "./harness.js";

// The health probes against a real database: the startup check in
// PrismaService and terminus's ping both have to pass.

describe("health (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createE2eApp());
  });

  afterAll(async () => {
    await app?.close();
  });

  it("GET /health/live answers without a session", async () => {
    const res = await request(app.getHttpServer()).get("/health/live").expect(200);
    expect(res.body).toMatchObject({ status: "ok", version: expect.any(String) });
  });

  it("GET /health/ready reports the database as up", async () => {
    const res = await request(app.getHttpServer()).get("/health/ready").expect(200);
    expect(res.body).toEqual({ status: "ok", checks: { database: { status: "up" } } });
  });
});
