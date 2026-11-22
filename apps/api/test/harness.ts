import { type INestApplication, Module, type Type } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { encode } from "@auth/core/jwt";
import { LoggerModule, Logger as PinoLogger } from "nestjs-pino";
import type { Options } from "pino-http";
import { AppModule } from "../src/app.module.js";
import { Clock } from "../src/calendar/clock.js";
import { PrismaService } from "../src/database/prisma.service.js";
import { FakeLlmAdapter } from "../src/llm/fake-llm.adapter.js";
import { LlmAdapter } from "../src/llm/llm-adapter.js";
import { LoggingModule, pinoParams } from "../src/logging/logging.module.js";
import { trustProxy } from "../src/rate-limit/rate-limit.module.js";
import { assertLocalDatabase, E2E_AUTH_SECRET, E2E_DATABASE_NAME } from "./env.js";

// Boots the real AppModule (config, database, guards, HTTP pipeline) against
// the throwaway Postgres. Tests call it with Supertest:
//
//   const { app, prisma } = await createE2eApp();
//   await request(app.getHttpServer()).get("/products").set("Cookie", cookie);

/**
 * The app's pino setup (same fields and redaction) at another level:
 * silent so test output stays readable. Set E2E_LOG=error (or warn, info,
 * debug) to see the app's logs when a test fails with an unexpected 500.
 */
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: { ...(pinoParams("test").pinoHttp as Options), level: process.env.E2E_LOG ?? "silent" },
    }),
  ],
})
class E2eLoggingModule {}

export interface E2eApp {
  app: INestApplication;
  prisma: PrismaService;
}

/**
 * The API as main.ts sets it up, minus OpenAPI and listen(). `imports`
 * adds modules with test-only routes, which go through the same global
 * guards and pipeline as real ones. `clock` replaces the Clock provider,
 * usually with a FixedClock the test moves; global time stays real.
 * `llm` replaces the Claude adapter; without it every LLM call gets an
 * empty FakeLlmAdapter, so no e2e test reaches Anthropic or Secrets Manager.
 */
export async function createE2eApp({
  imports = [],
  clock,
  llm = new FakeLlmAdapter(),
}: { imports?: Type[]; clock?: Clock; llm?: LlmAdapter } = {}): Promise<E2eApp> {
  let builder = Test.createTestingModule({ imports: [AppModule, ...imports] })
    .overrideModule(LoggingModule)
    .useModule(E2eLoggingModule);
  if (clock) builder = builder.overrideProvider(Clock).useValue(clock);
  builder = builder.overrideProvider(LlmAdapter).useValue(llm);
  const moduleRef = await builder.compile();
  // Check the URL the app actually got, not the one setup-env.ts meant to
  // set: if apps/api/.env won, stop before init() opens a connection.
  assertLocalDatabase(moduleRef.get(ConfigService).getOrThrow<string>("DATABASE_URL"));
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  // Nest's Logger writes through pino, as in main.ts, so E2E_LOG covers both.
  app.useLogger(app.get(PinoLogger));
  trustProxy(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/**
 * Empties every table except Prisma's migration history. Call it in
 * beforeEach so each test starts from its own fixtures.
 */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  // Ask the server which database this client is connected to, so the
  // check holds whatever URL it was built from.
  const [{ name }] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  if (name !== E2E_DATABASE_NAME) {
    throw new Error(`resetDatabase only empties ${E2E_DATABASE_NAME} (connected to ${name})`);
  }
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/** Auth.js's cookie name outside production (NODE_ENV is "test" here). */
const SESSION_COOKIE = "authjs.session-token";

/**
 * A `Cookie` header value for a signed-in user, encrypted the way the App's
 * next-auth does it, so requests go through the real SessionGuard.
 */
export async function sessionCookie(userId: string): Promise<string> {
  const token = await encode({ token: { id: userId }, secret: E2E_AUTH_SECRET, salt: SESSION_COOKIE });
  return `${SESSION_COOKIE}=${token}`;
}
