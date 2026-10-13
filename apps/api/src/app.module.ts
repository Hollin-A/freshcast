import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ApiExceptionFilter } from "./common/api-exception.filter.js";
import { EnvelopeInterceptor } from "./common/envelope.interceptor.js";
import { validateEnv } from "./config/env.schema.js";
import { DatabaseModule } from "./database/database.module.js";
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
  ],
  providers: [
    // Registered here rather than in main.ts so they also apply when tests
    // build the app from AppModule.
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
  ],
})
export class AppModule {}
