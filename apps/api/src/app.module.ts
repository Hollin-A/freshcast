import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ApiExceptionFilter } from "./common/api-exception.filter.js";
import { validateEnv } from "./config/env.schema.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { LoggingModule } from "./logging/logging.module.js";
import { SecretsModule } from "./secrets/secrets.module.js";

@Module({
  imports: [
    // Reads apps/api/.env locally; in production the variables come from the
    // ECS task definition. Invalid values stop startup (see env.schema.ts).
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    LoggingModule,
    DatabaseModule,
    SecretsModule,
    HealthModule,
  ],
  providers: [
    // Registered here rather than in main.ts so it also applies when tests
    // build the app from AppModule.
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
