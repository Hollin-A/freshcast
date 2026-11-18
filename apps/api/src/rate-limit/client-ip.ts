import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { Request } from "express";

/** Sent by the App's `/api/*` proxy (#35): the shared PROXY_SECRET. */
export const PROXY_SECRET_HEADER = "x-freshcast-proxy-secret";
/** Sent by the App's `/api/*` proxy alongside the secret: the browser's IP. */
export const CLIENT_IP_HEADER = "x-freshcast-client-ip";

/**
 * The IP of the client that made the request, for rate limiting.
 *
 * Requests the App proxies (ADR-020 D2) reach the ALB from the App's
 * servers, so `req.ip` is the App's address and every browser would share
 * one limit. The App sends the browser's IP in CLIENT_IP_HEADER, and the API
 * believes it only when PROXY_SECRET_HEADER matches PROXY_SECRET: the ALB is
 * public, so anyone else could set the header.
 *
 * Otherwise it's `req.ip`, the entry the ALB appends to X-Forwarded-For
 * (`trust proxy`, see rate-limit.module.ts).
 */
export function clientIp(req: Request, proxySecret: string | undefined): string | undefined {
  if (proxySecret) {
    const secret = req.headers[PROXY_SECRET_HEADER];
    const ip = req.headers[CLIENT_IP_HEADER];
    if (typeof secret === "string" && typeof ip === "string" && safeEqual(secret, proxySecret)) {
      const trimmed = ip.trim();
      if (isIP(trimmed)) return trimmed;
    }
  }
  return req.ip;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
