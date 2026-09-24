/**
 * Credential checks shared by the auth Server Actions (`lib/auth/actions.ts`)
 * and the `/api/auth/*` route handlers. Neither sets a cookie — callers do,
 * via `createSession()`, because cookies may only be written from a Server
 * Action or a Route Handler.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { usersCollection } from "@/lib/db/collections";
import type { UserDoc } from "@/lib/db/models";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const SignupInput = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().trim().min(1).optional(),
});

const normalize = (email: string) => email.toLowerCase().trim();

/** The user for these credentials, or null (unknown email or wrong password). */
export async function authenticate(
  email: string,
  password: string,
): Promise<UserDoc | null> {
  const users = await usersCollection();
  const user = await users.findOne({ email: normalize(email) }).lean();
  if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
  return user;
}

/** Create an account, or return null when the email is already taken. */
export async function register(
  input: z.infer<typeof SignupInput>,
): Promise<UserDoc | null> {
  const email = normalize(input.email);
  const users = await usersCollection();
  if (await users.findOne({ email }).lean()) return null;

  const now = new Date();
  const user: UserDoc = {
    _id: new ObjectId(),
    email,
    passwordHash: await hashPassword(input.password),
    displayName: input.displayName,
    createdAt: now,
    updatedAt: now,
  };
  await users.create(user);
  return user;
}
