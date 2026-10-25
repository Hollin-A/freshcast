import { Writable } from "node:stream";
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  type INestApplication,
  Module,
  Post,
  Query,
} from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { LoggerModule, Logger as PinoLogger } from "nestjs-pino";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ApiException } from "./common/api-exception.js";
import { ApiExceptionFilter } from "./common/api-exception.filter.js";
import { paginated } from "./common/pagination.js";
import { pinoParams } from "./logging/logging.module.js";

// The global filter and logger from AppModule, around a test-only controller,
// without the database. Checks responses against ADR-023 (unwrapped
// resources, { items, meta }, RFC 9457 errors) and log lines against the web
// app's format (#14).

@Controller("test")
class TestController {
  @Get("plain")
  plain() {
    return { id: "p1", name: "Milk" };
  }

  @Get("meta")
  paged(@Query("limit") limit: string) {
    return paginated([{ id: "s1" }], { total: 1, limit: Number(limit), offset: 0 });
  }

  @Delete("item")
  @HttpCode(204)
  remove() {
    return undefined;
  }

  @Get("expected")
  expected() {
    throw new ApiException("ENTRY_NOT_EDITABLE", "Only today's entry can be edited.", 422);
  }

  @Get("invalid")
  invalid() {
    throw new ApiException("VALIDATION_ERROR", "Invalid request", 400, {
      errors: { name: ["Required"] },
    });
  }

  @Get("crash")
  crash() {
    throw new Error("connection string postgres://secret leaked");
  }

  @Post("echo")
  echo() {
    return { ok: true };
  }
}

const lines: Record<string, unknown>[] = [];
const sink = new Writable({
  write(chunk: Buffer, _encoding, done) {
    for (const line of chunk.toString().split("\n").filter(Boolean)) lines.push(JSON.parse(line));
    done();
  },
});

@Module({
  imports: [LoggerModule.forRoot(pinoParams("production", sink))],
  controllers: [TestController],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
class TestAppModule {}

const completed = () => lines.filter((l) => l.message === "request completed");

describe("HTTP pipeline", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(PinoLogger));
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    lines.length = 0;
  });

  describe("responses", () => {
    it("returns a resource unwrapped", async () => {
      const res = await request(app.getHttpServer()).get("/test/plain").expect(200);
      expect(res.body).toEqual({ id: "p1", name: "Milk" });
    });

    it("returns { items, meta } for paginated()", async () => {
      const res = await request(app.getHttpServer()).get("/test/meta?limit=20").expect(200);
      expect(res.body).toEqual({
        items: [{ id: "s1" }],
        meta: { total: 1, limit: 20, offset: 0 },
      });
    });

    it("sends no body for a 204", async () => {
      const res = await request(app.getHttpServer()).delete("/test/item").expect(204);
      expect(res.text).toBe("");
    });
  });

  describe("problem details", () => {
    it("returns an ApiException as RFC 9457 Problem Details", async () => {
      const res = await request(app.getHttpServer())
        .get("/test/expected")
        .expect(422)
        .expect("content-type", /^application\/problem\+json/);
      expect(res.body).toEqual({
        type: "https://api.freshcast.site/problems/entry-not-editable",
        title: "Entry not editable",
        status: 422,
        detail: "Only today's entry can be edited.",
        code: "ENTRY_NOT_EDITABLE",
      });
      expect(lines).toContainEqual(
        expect.objectContaining({
          level: "warn",
          context: "api",
          message: "ENTRY_NOT_EDITABLE: Only today's entry can be edited.",
        })
      );
    });

    it("includes field errors for VALIDATION_ERROR", async () => {
      const res = await request(app.getHttpServer()).get("/test/invalid").expect(400);
      expect(res.body).toMatchObject({
        code: "VALIDATION_ERROR",
        status: 400,
        errors: { name: ["Required"] },
      });
    });

    it("hides unexpected errors behind a generic 500 and logs the cause", async () => {
      const res = await request(app.getHttpServer())
        .get("/test/crash")
        .expect(500)
        .expect("content-type", /^application\/problem\+json/);
      expect(res.body).toEqual({
        type: "https://api.freshcast.site/problems/internal-error",
        title: "Internal error",
        status: 500,
        detail: "Something went wrong",
        code: "INTERNAL_ERROR",
      });
      expect(JSON.stringify(res.body)).not.toContain("secret");
      const logged = lines.find((l) => l.message === "Unhandled error in route handler");
      expect(logged).toMatchObject({ level: "error", context: "api" });
      expect(JSON.stringify(logged)).toContain("connection string");
    });

    it("maps an unknown route to NOT_FOUND", async () => {
      const res = await request(app.getHttpServer())
        .get("/nope")
        .expect(404)
        .expect("content-type", /^application\/problem\+json/);
      expect(res.body).toMatchObject({ code: "NOT_FOUND", status: 404, title: "Not found" });
    });

    it("maps a malformed JSON body to VALIDATION_ERROR", async () => {
      const res = await request(app.getHttpServer())
        .post("/test/echo")
        .set("content-type", "application/json")
        .send("{not json")
        .expect(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("request IDs and logging", () => {
    it("reuses a valid incoming x-request-id and tags every log line with it", async () => {
      const res = await request(app.getHttpServer())
        .get("/test/expected")
        .set("x-request-id", "web-abc.123");
      expect(res.headers["x-request-id"]).toBe("web-abc.123");
      expect(lines.length).toBeGreaterThanOrEqual(2);
      for (const line of lines) expect(line.requestId).toBe("web-abc.123");
    });

    it("replaces a malformed x-request-id with a UUID", async () => {
      const res = await request(app.getHttpServer())
        .get("/test/plain")
        .set("x-request-id", "bad id; drop table");
      expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("writes one request completed line in the web app's format", async () => {
      await request(app.getHttpServer()).get("/test/meta?limit=20&secret=x");
      expect(completed()).toHaveLength(1);
      const [line] = completed();
      expect(Object.keys(line).sort()).toEqual(
        ["context", "data", "level", "message", "requestId", "timestamp"].sort()
      );
      expect(line).toMatchObject({
        level: "info",
        context: "http",
        data: { method: "GET", path: "/test/meta", status: 200 },
      });
      expect(typeof (line.data as { durationMs: unknown }).durationMs).toBe("number");
      expect(Number.isNaN(Date.parse(line.timestamp as string))).toBe(false);
      expect(JSON.stringify(line)).not.toContain("secret");
    });

    it("never logs headers such as cookies or authorization", async () => {
      await request(app.getHttpServer())
        .get("/test/expected")
        .set("cookie", "authjs.session-token=SESSIONSECRET")
        .set("authorization", "Bearer TOKENSECRET");
      const logged = JSON.stringify(lines);
      expect(logged).not.toContain("SESSIONSECRET");
      expect(logged).not.toContain("TOKENSECRET");
    });

    it("logs 4xx requests at warn and 5xx at error", async () => {
      await request(app.getHttpServer()).get("/test/expected");
      await request(app.getHttpServer()).get("/test/crash");
      expect(completed().map((l) => l.level)).toEqual(["warn", "error"]);
    });
  });
});
