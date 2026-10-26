import { applyDecorators, type Type } from "@nestjs/common";
import { ApiExtraModels, ApiResponse, getSchemaPath } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { PROBLEM_CODES, problemDetailsSchema } from "@freshcast/shared";

const codeList = Object.entries(PROBLEM_CODES)
  .map(([code, meaning]) => `- \`${code}\`: ${meaning}`)
  .join("\n");

// A string rather than an enum, so a new code isn't a breaking change for
// generated clients.
export class ProblemDetailsDto extends createZodDto(
  problemDetailsSchema.extend({
    code: z.string().describe(`A stable code for clients to switch on:\n\n${codeList}`),
  })
) {}

/**
 * Documents an error response as application/problem+json (ADR-023). `type`
 * is a DTO that extends Problem Details, for routes that add extensions.
 */
export function ApiProblemResponse(
  status: number,
  description: string,
  type: Type = ProblemDetailsDto
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiExtraModels(type),
    ApiResponse({
      status,
      description,
      content: { "application/problem+json": { schema: { $ref: getSchemaPath(type) } } },
    })
  );
}
