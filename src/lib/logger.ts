import { getRequestId } from "./request-context";

type LogLevel = "info" | "warn" | "error" | "debug";

const COLORS: Record<LogLevel, string> = {
  info: "\x1b[36m",   // cyan
  warn: "\x1b[33m",   // yellow
  error: "\x1b[31m",  // red
  debug: "\x1b[90m",  // gray
};
const RESET = "\x1b[0m";

// Production logs are one JSON object per line so CloudWatch can filter on
// fields; local dev keeps the colored, human-readable format.
const JSON_LOGS = process.env.NODE_ENV === "production";

function formatTimestamp(): string {
  return new Date().toISOString();
}

// JSON.stringify turns Error instances into {}; keep their message and stack.
function errorReplacer(_key: string, value: unknown) {
  return value instanceof Error ? { error: value.message, stack: value.stack } : value;
}

function toJson(value: unknown, indent?: number): string {
  try {
    return JSON.stringify(value, errorReplacer, indent);
  } catch {
    return String(value);
  }
}

function log(level: LogLevel, context: string, message: string, data?: unknown) {
  const write = level === "error" ? console.error : console.log;
  const requestId = getRequestId();

  if (JSON_LOGS) {
    const entry: Record<string, unknown> = { level, timestamp: formatTimestamp(), context, message };
    if (requestId) entry.requestId = requestId;
    if (data !== undefined) entry.data = data;
    write(toJson(entry));
    return;
  }

  const color = COLORS[level];
  const req = requestId ? ` [req:${requestId.slice(0, 8)}]` : "";
  const prefix = `${color}[${level.toUpperCase()}]${RESET} ${formatTimestamp()} [${context}]${req}`;

  if (data === undefined) {
    write(`${prefix} ${message}`);
  } else if (data instanceof Error) {
    write(`${prefix} ${message}`, { error: data.message, stack: data.stack });
  } else {
    write(`${prefix} ${message}`, typeof data === "object" ? toJson(data, 2) : data);
  }
}

export const logger = {
  info: (context: string, message: string, data?: unknown) =>
    log("info", context, message, data),
  warn: (context: string, message: string, data?: unknown) =>
    log("warn", context, message, data),
  error: (context: string, message: string, data?: unknown) =>
    log("error", context, message, data),
  debug: (context: string, message: string, data?: unknown) => {
    if (process.env.NODE_ENV !== "production") {
      log("debug", context, message, data);
    }
  },
};
