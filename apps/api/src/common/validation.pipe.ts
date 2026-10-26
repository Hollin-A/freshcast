import { type ArgumentMetadata, Injectable, type PipeTransform } from "@nestjs/common";
import type { ZodDto } from "nestjs-zod";
import type { z } from "zod";
import { ApiException } from "./api-exception.js";

/**
 * Validates every @Body(), @Query() and @Param() against its nestjs-zod DTO
 * (ADR-020 D4). Invalid input becomes a 400 VALIDATION_ERROR with field
 * messages (ADR-023), never a 500.
 *
 * Request inputs must be typed with a whole-object DTO, such as
 * `@Query() query: ListSalesQueryDto`. A primitive like
 * `@Param("id") id: string` is a programming error and fails with a 500,
 * so no input reaches a handler unvalidated. Custom parameter decorators
 * such as @CurrentBusiness() (#29) supply server-side values and are skipped.
 */
@Injectable()
export class ZodRequestPipe implements PipeTransform {
  transform(value: unknown, { type, metatype, data }: ArgumentMetadata): unknown {
    if (type === "custom") return value;
    if (!isZodDto(metatype)) {
      const param = data ? `@${capitalise(type)}("${data}")` : `@${capitalise(type)}()`;
      throw new Error(`${param} must be typed with a nestjs-zod DTO`);
    }

    const result = (metatype.schema as z.ZodType).safeParse(value);
    if (result.success) return result.data;
    throw new ApiException("VALIDATION_ERROR", `Invalid request ${type}`, 400, {
      errors: fieldErrors(result.error, type),
    });
  }
}

/**
 * Groups Zod issues by field path ("items.0.quantity"). Issues about the
 * whole input, such as a missing body, are keyed by its source ("body").
 */
export function fieldErrors(error: z.ZodError, source: string): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : source;
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}

function isZodDto(metatype: unknown): metatype is ZodDto {
  return typeof metatype === "function" && "isZodDto" in metatype && metatype.isZodDto === true;
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
