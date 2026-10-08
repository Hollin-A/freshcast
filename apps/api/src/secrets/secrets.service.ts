import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

export const SECRETS_MANAGER_CLIENT = Symbol("SECRETS_MANAGER_CLIENT");

/**
 * Hybrid secret resolver, ported from the web app (ADR-018).
 *
 * Resolution order:
 *   1. process.env[envName]: returned immediately when set. Used in local
 *      development and as a manual override if Secrets Manager is unavailable.
 *   2. AWS Secrets Manager at smId: fetched once per process and memoized.
 *      Rotating a secret therefore takes effect when tasks are replaced on
 *      the next deploy.
 *
 * Returns null when Secrets Manager fails, so callers can degrade gracefully.
 */
@Injectable()
export class SecretsService {
  private readonly logger = new Logger(SecretsService.name);
  private readonly cache = new Map<string, Promise<string | null>>();

  constructor(
    @Inject(SECRETS_MANAGER_CLIENT) private readonly client: SecretsManagerClient
  ) {}

  async get(envName: string, smId: string): Promise<string | null> {
    const envValue = process.env[envName];
    if (envValue) return envValue;

    let pending = this.cache.get(smId);
    if (!pending) {
      pending = this.fetch(smId);
      this.cache.set(smId, pending);
    }
    return pending;
  }

  private async fetch(smId: string): Promise<string | null> {
    try {
      const result = await this.client.send(
        new GetSecretValueCommand({ SecretId: smId })
      );
      return result.SecretString ?? null;
    } catch (err) {
      this.logger.error(`Failed to fetch ${smId} from Secrets Manager`, err);
      return null;
    }
  }
}
