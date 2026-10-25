import { z } from "zod";
import { problemDetailsSchema } from "./problem.js";

// The API's health endpoints (ADR-023 §7, #28).

// GET /health/live: the process is up. The ALB health check calls it.
export const healthLiveSchema = z.object({
  status: z.literal("ok"),
  version: z.string(),
  uptimeSeconds: z.number(),
});

export type HealthLive = z.infer<typeof healthLiveSchema>;

export const healthCheckStatusSchema = z.object({
  status: z.enum(["up", "down"]),
});

// GET /health/ready: every dependency check passed. One entry per check.
export const healthReadySchema = z.object({
  status: z.literal("ok"),
  checks: z.record(z.string(), healthCheckStatusSchema),
});

export type HealthReady = z.infer<typeof healthReadySchema>;

// The 503 from /health/ready: SERVICE_UNAVAILABLE Problem Details with the
// result of each check.
export const healthUnavailableSchema = problemDetailsSchema.extend({
  checks: z.record(z.string(), healthCheckStatusSchema),
});

export type HealthUnavailable = z.infer<typeof healthUnavailableSchema>;
