import type { IncomingMessage, ServerResponse } from "node:http";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LoggerModule, type Params } from "nestjs-pino";
import type { DestinationStream } from "pino";
import type { Options } from "pino-http";
import type { Env } from "../config/env.schema.js";
import { REQUEST_ID_HEADER, resolveRequestId } from "./request-id.js";

type Req = IncomingMessage & { originalUrl?: string };

function requestFields(req: Req, res: ServerResponse, responseTime: number) {
  const url = req.originalUrl ?? req.url ?? "/";
  return {
    context: "http",
    data: {
      method: req.method,
      // Path only: query strings and bodies are never logged.
      path: new URL(url, "http://localhost").pathname,
      status: res.statusCode,
      durationMs: Math.round(responseTime),
    },
  };
}

/**
 * Pino options that reproduce the web app's log format (#14) so CloudWatch
 * queries work across both: one JSON object per line with `level`,
 * `timestamp`, `context`, `message`, `requestId` and `data`. Development
 * gets pino-pretty's readable output instead. Tests pass a `stream` to
 * capture the lines.
 */
export function pinoParams(nodeEnv: Env["NODE_ENV"], stream?: DestinationStream): Params {
  const options: Options = {
    level: nodeEnv === "production" ? "info" : "debug",
    messageKey: "message",
    base: undefined,
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    formatters: { level: (label) => ({ level: label }) },

    // Request ID: reuse a valid incoming x-request-id or create one, and
    // return it on the response. Every log line written while handling the
    // request carries it as `requestId`.
    genReqId: (req, res) => {
      const id = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
      res.setHeader(REQUEST_ID_HEADER, id);
      return id;
    },
    // Bind only the request ID to log lines. Without these, pino-http adds
    // the whole request (including cookie and authorization headers).
    quietReqLogger: true,
    quietResLogger: true,
    customAttributeKeys: { reqId: "requestId" },

    // One "request completed" line per request, at a level matching the
    // status, with only method, path, status and duration.
    customLogLevel: (_req, res, err) =>
      err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
    customSuccessMessage: () => "request completed",
    customErrorMessage: () => "request completed",
    customSuccessObject: (req, res, val: { responseTime: number }) =>
      requestFields(req as Req, res, val.responseTime),
    customErrorObject: (req, res, _err, val: { responseTime: number }) =>
      requestFields(req as Req, res, val.responseTime),

    transport:
      nodeEnv === "development" && !stream
        ? { target: "pino-pretty", options: { messageKey: "message", singleLine: true } }
        : undefined,
  };
  return { pinoHttp: stream ? [options, stream] : options };
}

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        pinoParams(config.get("NODE_ENV", { infer: true })),
    }),
  ],
})
export class LoggingModule {}
