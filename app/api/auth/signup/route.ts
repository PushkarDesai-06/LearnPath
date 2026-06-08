import { ObjectId } from "mongodb";
import { z } from "zod";
import { usersCollection } from "@/lib/db/collections";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { publicUser } from "@/lib/auth/guards";
import { conflict, handler, json, readJson } from "@/lib/http";

const SignupBody = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().trim().min(1).optional(),
});

export const POST = handler(async (request) => {
  const { email, password, displayName } = await readJson(request, SignupBody);
  const normalizedEmail = email.toLowerCase().trim();

  const users = await usersCollection();
  const existing = await users.findOne({ email: normalizedEmail }).lean();
  if (existing) throw conflict("An account with this email already exists");

  const now = new Date();
  const user = {
    _id: new ObjectId(),
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    displayName,
    createdAt: now,
    updatedAt: now,
  };
  await users.create(user);

  await createSession(user._id, request.headers.get("user-agent") ?? undefined);
  return json({ user: publicUser(user) }, 201);
});
