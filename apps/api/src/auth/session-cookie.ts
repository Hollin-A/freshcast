import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getToken } from "@auth/core/jwt";
import type { IncomingHttpHeaders } from "node:http";
import type { Env } from "../config/env.schema.js";

/**
 * Reads the App's Auth.js session cookie (ADR-020 D3 step 1, ADR-023 §10).
 *
 * The cookie is a JWE encrypted with a key derived from AUTH_SECRET, salted
 * with the cookie name. Auth.js's own getToken() does the decryption: it
 * picks the cookie name, joins chunked cookies and checks `exp`. That is why
 * @auth/core is pinned to the exact version next-auth uses; a mismatch fails
 * auth-bridge.test.ts. Stage 6 replaces this with tokens the API issues.
 */
@Injectable()
export class SessionCookieReader {
  private readonly secret: string;
  // Auth.js uses the __Secure- cookie (and salt) when the App runs on HTTPS,
  // which is every deployed environment.
  private readonly secureCookie: boolean;

  constructor(config: ConfigService<Env, true>) {
    this.secret = config.get("AUTH_SECRET", { infer: true });
    this.secureCookie = config.get("NODE_ENV", { infer: true }) === "production";
  }

  /** The signed-in user's ID, or null for a missing, invalid or expired cookie. */
  async userId(headers: IncomingHttpHeaders): Promise<string | null> {
    const cookie = headers.cookie;
    if (!cookie) return null;
    // getToken() returns null for a cookie it can't decrypt or that has expired.
    const token = await getToken({
      req: { headers: { cookie } },
      secret: this.secret,
      secureCookie: this.secureCookie,
    });
    // The App's jwt callback stores the user ID as `id` (apps/web/src/lib/auth.ts).
    return typeof token?.id === "string" && token.id.length > 0 ? token.id : null;
  }
}
