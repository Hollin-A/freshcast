import { Logger, type INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import type { Env } from "./config/env.schema.js";

async function bootstrap(): Promise<void> {
  let app: INestApplication;
  try {
    // abortOnError: false makes startup errors (such as invalid config)
    // reject instead of aborting the process. Nest has already logged them.
    app = await NestFactory.create(AppModule, { abortOnError: false });
  } catch {
    process.exit(1);
  }

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
