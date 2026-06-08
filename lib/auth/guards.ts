/**
 * Authentication guard for route handlers. This is the AUTHORITATIVE check —
 * proxy.ts is only a cheap first gate, so every protected endpoint calls
 * requireUser() to do a real session + user lookup.
 */
import { readSession } from "@/lib/auth/session";
import { usersCollection } from "@/lib/db/collections";
import type { UserDoc } from "@/lib/db/models";
import { unauthorized } from "@/lib/http";

/**
 * Returns the authenticated user document or throws ApiError(401).
 */
export async function requireUser(): Promise<UserDoc> {
  const session = await readSession();
  if (!session) throw unauthorized();

  const users = await usersCollection();
  const user = await users.findOne({ _id: session.userId }).lean();
  if (!user) throw unauthorized();

  return user;
}

/**
 * A safe public projection of a user (never leaks passwordHash).
 */
export function publicUser(user: UserDoc) {
  return {
    id: user._id.toHexString(),
    email: user.email,
    displayName: user.displayName ?? null,
  };
}
