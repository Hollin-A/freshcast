type LogLevel = "info" | "warn" | "error" | "debug";

const COLORS: Record<LogLevel, string> = {
  info: "\x1b[36m",   // cyan
  warn: "\x1b[33m",   // yellow
  error: "\x1b[31m",  // red
  debug: "\x1b[90m",  // gray
};
const RESET = "\x1b[0m";

function formatTimestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, context: string, message: string, data?: unknown) {
  const color = COLORS[level];
  const prefix = `${color}[${level.toUpperCase()}]${RESET} ${formatTimestamp()} [${context}]`;

  if (data !== undefined) {
    if (data instanceof Error) {
      console[level === "error" ? "error" : "log"](
        `${prefix} ${message}`,
        { error: data.message, stack: data.stack }
      );
    } else {
      console[level === "error" ? "error" : "log"](
        `${prefix} ${message}`,
        typeof data === "object" ? JSON.stringify(data, null, 2) : data
      );
    }
  } else {
    console[level === "error" ? "error" : "log"](`${prefix} ${message}`);
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
