/**
 * Next.js 16 "proxy" (the renamed middleware). Runs before filesystem routes,
 * on the Node.js runtime by default — do NOT set a `runtime` config here.
 *
 * This is only a cheap first gate on cookie PRESENCE (it also runs on
 * prefetches, so it must not touch the DB):
 *   - API requests without a session cookie get a JSON 401.
 *   - Signed-in pages without a session cookie redirect to /login.
 * The authoritative check (verify JWT + look up the session/user in Mongo)
 * happens in every route via requireUser() and every page via
 * requireUserOrRedirect(), because proxy matchers can silently skip requests.
 * A cookie-bearing /login is NOT redirected here: the cookie may be stale, and
 * the login page does the verified redirect itself.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

// Public API paths that never require a session.
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/health"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = request.cookies.has(SESSION_COOKIE);

  if (pathname.startsWith("/api/")) {
    const isPublic = PUBLIC_API_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(p),
    );
    if (isPublic || hasCookie) return NextResponse.next();
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Everything else the matcher lets through is a signed-in page.
  if (hasCookie) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard",
    "/topics",
    "/account",
    "/tutor",
    "/curriculum",
    "/onboarding",
    "/assessment",
    "/learn/:path*",
  ],
};
