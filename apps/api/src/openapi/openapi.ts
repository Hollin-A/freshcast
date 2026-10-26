import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, type OpenAPIObject, SwaggerModule, getSchemaPath } from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";
import { PACKAGE_VERSION } from "../version.js";
import { ProblemDetailsDto } from "./problem.dto.js";

const DESCRIPTION = `The Freshcast API (ADR-023).

- Resources are returned unwrapped. Lists are \`{ items, meta: { total, limit, offset } }\`.
- Errors are RFC 9457 Problem Details (\`application/problem+json\`) with a
  stable \`code\`; see the \`ProblemDetailsDto\` schema for the list.`;

/** Builds the OpenAPI document from the controllers' Zod DTOs and decorators. */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Freshcast API")
    .setDescription(DESCRIPTION)
    .setVersion(PACKAGE_VERSION)
    // 3.1 is JSON Schema, which is what Zod 4 generates.
    .setOpenAPIVersion("3.1.0")
    .addGlobalResponse({
      status: 500,
      description: "An unexpected error",
      content: {
        "application/problem+json": { schema: { $ref: getSchemaPath(ProblemDetailsDto) } },
      },
    })
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [ProblemDetailsDto],
  });
  // Required by nestjs-zod to turn its Zod metadata into valid OpenAPI.
  return cleanupOpenApiDoc(document);
}

/**
 * Serves Swagger UI at /docs and the spec at /docs/json. Public in every
 * environment: the contract is no secret, and the routes are plain Express
 * handlers, so the auth guard (#29) never sees them.
 */
export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup("docs", app, createOpenApiDocument(app), {
    jsonDocumentUrl: "docs/json",
    raw: ["json"],
  });
}
