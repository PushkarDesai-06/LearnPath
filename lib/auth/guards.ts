/**
 * Authentication guard for route handlers. This is the AUTHORITATIVE check —
 * proxy.ts is only a cheap first gate, so every protected endpoint calls
 * requireUser() to do a real session + user lookup. Pages use
 * `requireUserOrRedirect()` from lib/auth/current.ts instead; both share the
 * same per-request `getCurrentUser()`.
 */
import { getCurrentUser } from "@/lib/auth/current";
import type { UserDoc } from "@/lib/db/models";
import type { SessionUser } from "@/lib/auth/types";
import { unauthorized } from "@/lib/http";

/**
 * Returns the authenticated user document or throws ApiError(401).
 */
export async function requireUser(): Promise<UserDoc> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

/**
 * A safe public projection of a user (never leaks passwordHash).
 */
export function publicUser(user: UserDoc): SessionUser {
  return {
    id: user._id.toHexString(),
    email: user.email,
    displayName: user.displayName ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
