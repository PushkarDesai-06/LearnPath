/**
 * Session management: a signed JWT cookie paired with a revocable server-side
 * `sessions` document. The JWT carries the session id (`sid`); revoking is just
 * deleting the Mongo doc, and the TTL index expires stale sessions.
 */
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { ObjectId } from "mongodb";
import { env } from "@/lib/env";
import { sessionsCollection } from "@/lib/db/collections";

export const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.sessionSecret);
}

/**
 * Create a session for a user: insert a sessions doc and set the signed cookie.
 */
export async function createSession(
  userId: ObjectId,
  userAgent?: string,
): Promise<void> {
  const tokenId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  const sessions = await sessionsCollection();
  await sessions.create({
    _id: new ObjectId(),
    userId,
    tokenId,
    createdAt: now,
    expiresAt,
    userAgent,
  });

  const jwt = await new SignJWT({ sid: tokenId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId.toHexString())
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Read and validate the current session. Returns the userId or null. Verifies
 * the JWT signature AND confirms the session doc still exists and is unexpired
 * (so revocation takes effect immediately).
 */
export async function readSession(): Promise<{ userId: ObjectId } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let sid: string;
  let sub: string | undefined;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    sid = payload.sid as string;
    sub = payload.sub;
  } catch {
    return null;
  }
  if (!sid || !sub) return null;

  const sessions = await sessionsCollection();
  const session = await sessions.findOne({ tokenId: sid }).lean();
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;

  return { userId: session.userId };
}

/**
 * Destroy the current session: delete the doc and clear the cookie.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey());
      const sid = payload.sid as string | undefined;
      if (sid) {
        const sessions = await sessionsCollection();
        await sessions.deleteOne({ tokenId: sid });
      }
    } catch {
      // invalid token — nothing to revoke server-side
    }
  }
  cookieStore.delete(SESSION_COOKIE);
}
