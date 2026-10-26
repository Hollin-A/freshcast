import type { Provider } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ZodSerializerInterceptor } from "nestjs-zod";
import { ApiExceptionFilter } from "./api-exception.filter.js";
import { ZodRequestPipe } from "./validation.pipe.js";

/**
 * The global request pipeline: Zod validation of request inputs, Zod
 * serialization of responses declared with @ZodResponse (unknown fields are
 * stripped, and a response that breaks its schema is a 500), and Problem
 * Details for every error. Registered as providers rather than in main.ts so
 * tests that build a module get the same pipeline.
 */
export const HTTP_PIPELINE: Provider[] = [
  { provide: APP_FILTER, useClass: ApiExceptionFilter },
  { provide: APP_PIPE, useClass: ZodRequestPipe },
  { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
];
