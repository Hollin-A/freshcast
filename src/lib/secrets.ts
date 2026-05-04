import "server-only";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { getAwsRuntimeConfig } from "./aws-config";
import { logger } from "./logger";

let smClient: SecretsManagerClient | null = null;

function getSmClient(): SecretsManagerClient {
  if (!smClient) {
    smClient = new SecretsManagerClient(getAwsRuntimeConfig());
  }
  return smClient;
}

const cache = new Map<string, Promise<string | null>>();

/**
 * Hybrid secret resolver.
 *
 * Resolution order:
 *   1. process.env[envName] — when set, returned immediately. Used in local
 *      development (.env.local), preview branches, and as a manual override
 *      or SM-outage rollback.
 *   2. AWS Secrets Manager at smId — fetched once per warm Lambda container
 *      and memoized for the rest of its lifetime. Rotating a secret in SM
 *      therefore takes effect on the next deploy (which spawns new Lambdas),
 *      consistent with how rotating a process.env value behaves today.
 *
 * On SM error returns null so callers can degrade gracefully (e.g. claude.ts
 * skips LLM calls; weekly-summary route returns 401 if CRON_SECRET cannot be
 * resolved).
 *
 * See docs/adr/018-secrets-manager.md.
 */
export async function getSecret(
  envName: string,
  smId: string
): Promise<string | null> {
  const envVal = process.env[envName];
  if (envVal) return envVal;

  if (!cache.has(smId)) {
    cache.set(smId, fetchFromSm(smId));
  }
  return cache.get(smId)!;
}

async function fetchFromSm(smId: string): Promise<string | null> {
  try {
    const result = await getSmClient().send(
      new GetSecretValueCommand({ SecretId: smId })
    );
    return result.SecretString ?? null;
  } catch (err) {
    logger.error("secrets", `Failed to fetch ${smId} from Secrets Manager`, err);
    return null;
  }
}

/**
 * Test-only: clears the per-process memoization cache. Not exported from
 * production callers; lives on the module so secrets.test.ts can isolate
 * cases without spinning up a worker per test.
 */
export function __resetSecretsCacheForTests(): void {
  cache.clear();
  smClient = null;
}
