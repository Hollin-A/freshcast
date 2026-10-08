import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./config/env.schema.js";
import { DatabaseModule } from "./database/database.module.js";
import { SecretsModule } from "./secrets/secrets.module.js";

@Module({
  imports: [
    // Reads apps/api/.env locally; in production the variables come from the
    // ECS task definition. Invalid values stop startup (see env.schema.ts).
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    DatabaseModule,
    SecretsModule,
  ],
})
export class AppModule {}
