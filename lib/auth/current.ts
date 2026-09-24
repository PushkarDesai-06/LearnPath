/**
 * The current user, resolved once per request.
 *
 * `getCurrentUser` is wrapped in React `cache()`, so the root layout's Nav, the
 * page, and any nested server component share ONE session + user lookup per
 * request. Outside a React render (route handlers, server actions) `cache()`
 * simply calls through, so `requireUser()` in guards.ts reuses it safely.
 */
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { usersCollection } from "@/lib/db/collections";
import type { UserDoc } from "@/lib/db/models";

export const getCurrentUser = cache(async (): Promise<UserDoc | null> => {
  const session = await readSession();
  if (!session) return null;
  const users = await usersCollection();
  return users.findOne({ _id: session.userId }).lean();
});

/**
 * For pages: the signed-in user, or a redirect to /login. `redirect()` throws,
 * so never call this inside a try/catch, and call it before any <Suspense> so
 * the redirect is a real 307 rather than a streamed client-side one.
 */
export async function requireUserOrRedirect(): Promise<UserDoc> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
