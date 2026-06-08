/**
 * Next.js 16 "proxy" (the renamed middleware). Runs before filesystem routes,
 * on the Node.js runtime by default — do NOT set a `runtime` config here.
 *
 * This is only a cheap first gate: it rejects API requests that carry no
 * session cookie at all. The authoritative check (verify JWT + look up the
 * session/user in Mongo) happens inside each protected route via requireUser(),
 * because proxy matchers can silently skip some requests and must not be the
 * sole line of defense.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

// Public API paths that never require a session.
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/health"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p),
  );
  if (isPublic) return NextResponse.next();

  const hasCookie = request.cookies.has(SESSION_COOKIE);
  if (!hasCookie) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  // Only guard API routes for now (backend-only build).
  matcher: ["/api/:path*"],
};
