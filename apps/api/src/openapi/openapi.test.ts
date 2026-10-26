import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { TerminusModule } from "@nestjs/terminus";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PROBLEM_CODES } from "@freshcast/shared";
import { HTTP_PIPELINE } from "../common/http-pipeline.js";
import { PrismaService } from "../database/prisma.service.js";
import { HealthController } from "../health/health.controller.js";
import { setupOpenApi } from "./openapi.js";

// The served OpenAPI document, built from the real controllers' DTOs and
// decorators. Add each migrated controller here so its contract is checked.

type Spec = {
  openapi: string;
  paths: Record<string, Record<string, { responses: Record<string, Response> }>>;
  components: { schemas: Record<string, { properties?: Record<string, { description?: string }> }> };
};
type Response = { content?: Record<string, { schema: { $ref?: string } }> };

const ref = (response: Response, mediaType: string) => response.content?.[mediaType]?.schema.$ref;

describe("OpenAPI docs", () => {
  let app: INestApplication;
  let spec: Spec;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TerminusModule.forRoot({ logger: false })],
      controllers: [HealthController],
      providers: [
        ...HTTP_PIPELINE,
        { provide: PrismaService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    setupOpenApi(app);
    await app.init();
    spec = (await request(app.getHttpServer()).get("/docs/json").expect(200)).body;
  });

  afterAll(() => app.close());

  it("serves Swagger UI at /docs", async () => {
    const res = await request(app.getHttpServer()).get("/docs").expect(200);
    expect(res.text).toContain("swagger-ui");
  });

  it("is OpenAPI 3.1", () => {
    expect(spec.openapi).toBe("3.1.0");
  });

  it("documents the health responses from their Zod schemas", () => {
    const live = spec.paths["/health/live"].get.responses;
    expect(ref(live["200"], "application/json")).toBe("#/components/schemas/HealthLiveDto_Output");

    const ready = spec.paths["/health/ready"].get.responses;
    expect(ref(ready["200"], "application/json")).toBe("#/components/schemas/HealthReadyDto_Output");
    expect(ref(ready["503"], "application/problem+json")).toBe(
      "#/components/schemas/HealthUnavailableDto"
    );
    expect(spec.components.schemas.HealthLiveDto_Output.properties).toHaveProperty("uptimeSeconds");
  });

  it("documents a Problem Details 500 on every route", () => {
    for (const methods of Object.values(spec.paths)) {
      for (const { responses } of Object.values(methods)) {
        expect(ref(responses["500"], "application/problem+json")).toBe(
          "#/components/schemas/ProblemDetailsDto"
        );
      }
    }
  });

  it("lists every problem code", () => {
    const code = spec.components.schemas.ProblemDetailsDto.properties?.code;
    for (const name of Object.keys(PROBLEM_CODES)) expect(code?.description).toContain(name);
  });
});
