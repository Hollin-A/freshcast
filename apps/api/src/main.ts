import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Logger as PinoLogger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import type { Env } from "./config/env.schema.js";
import { setupOpenApi } from "./openapi/openapi.js";
import { trustProxy } from "./rate-limit/rate-limit.module.js";

async function bootstrap(): Promise<void> {
  let app: NestExpressApplication;
  try {
    // abortOnError: false makes startup errors (such as invalid config)
    // reject instead of aborting the process. Nest has already logged them.
    // bufferLogs holds startup logs until pino is ready, so they share its format.
    app = await NestFactory.create<NestExpressApplication>(AppModule, { abortOnError: false, bufferLogs: true });
  } catch {
    process.exit(1);
  }
  app.useLogger(app.get(PinoLogger));
  // Nest only flushes the buffer once listen() succeeds, so a failure during
  // init (such as the startup database check) would exit without a log line.
  app.flushLogs();

  // Run onModuleDestroy hooks on SIGTERM, which ECS sends before stopping a task.
  app.enableShutdownHooks();

  trustProxy(app);
  setupOpenApi(app);

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get("PORT", { infer: true });
  await app.listen(port);
  Logger.log(`Listening on port ${port}`, "Bootstrap");
}

bootstrap().catch((err: unknown) => {
  Logger.error(err, "Bootstrap");
  process.exit(1);
});
