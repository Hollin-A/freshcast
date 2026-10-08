import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import type { Env } from "../config/env.schema.js";
import { SECRETS_MANAGER_CLIENT, SecretsService } from "./secrets.service.js";

@Module({
  providers: [
    {
      // Credentials come from the AWS SDK's default provider chain: the ECS
      // task role in production, a local profile or env vars in development.
      provide: SECRETS_MANAGER_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new SecretsManagerClient({ region: config.get("AWS_REGION", { infer: true }) }),
    },
    SecretsService,
  ],
  exports: [SecretsService],
})
export class SecretsModule {}
