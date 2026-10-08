import { z } from "zod";

/**
 * Environment variables the API needs at startup. ConfigModule validates
 * them once when the app boots, so a missing or malformed value stops the
 * process with a clear message instead of failing on the first request.
 *
 * Secrets that callers resolve on demand (ANTHROPIC_API_KEY, ...) are not
 * listed here; they go through SecretsService (ADR-018).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: (issue) =>
      issue.input === undefined
        ? "is required"
        : "must be a postgres:// or postgresql:// connection string",
  }),
  AWS_REGION: z.string().min(1).default("ap-southeast-2"),
});

export type Env = z.infer<typeof envSchema>;

/** `validate` hook for ConfigModule: returns typed values or throws. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`
    );
  }
  return result.data;
}
