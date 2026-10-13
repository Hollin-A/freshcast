import { Logger, type INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { Logger as PinoLogger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import type { Env } from "./config/env.schema.js";

async function bootstrap(): Promise<void> {
  let app: INestApplication;
  try {
    // abortOnError: false makes startup errors (such as invalid config)
    // reject instead of aborting the process. Nest has already logged them.
    // bufferLogs holds startup logs until pino is ready, so they share its format.
    app = await NestFactory.create(AppModule, { abortOnError: false, bufferLogs: true });
  } catch {
    process.exit(1);
  }
  app.useLogger(app.get(PinoLogger));

  // Run onModuleDestroy hooks on SIGTERM, which ECS sends before stopping a task.
  app.enableShutdownHooks();

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get("PORT", { infer: true });
  await app.listen(port);
  Logger.log(`Listening on port ${port}`, "Bootstrap");
}

bootstrap().catch((err: unknown) => {
  Logger.error(err, "Bootstrap");
  process.exit(1);
});
