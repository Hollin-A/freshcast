import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { REQUEST_ID_HEADER, resolveRequestId, runWithRequestContext } from "@/lib/request-context";

const publicRoutes = ["/login", "/signup", "/verify", "/forgot-password", "/reset-password", "/api/auth/verify-email"];

// For API requests, assign a request ID (or reuse a valid incoming one), pass
// it to the route handler, and return it to the client.
function nextWithRequestId(request: NextRequest, requestId: string) {
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api");
  const requestId = isApi ? resolveRequestId(request.headers.get(REQUEST_ID_HEADER)) : null;

  // Allow public routes and API auth routes
  if (
    publicRoutes.some((route) => pathname.startsWith(route)) ||
    pathname.startsWith("/api/auth")
  ) {
    return requestId ? nextWithRequestId(request, requestId) : NextResponse.next();
  }

  // Check for session token (Auth.js JWT cookie)
  const token =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (!token && !pathname.startsWith("/api")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!token && requestId) {
    // Rejected here, so the route's request logging never runs; log it now.
    runWithRequestContext({ requestId }, () =>
      logger.warn("http", "request completed", {
        method: request.method,
        path: pathname,
        status: 401,
        handledBy: "proxy",
      })
    );
    const response = NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }

  return requestId ? nextWithRequestId(request, requestId) : NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.svg$).*)",
  ],
};
