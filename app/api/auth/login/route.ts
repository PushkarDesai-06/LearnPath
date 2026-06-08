import { z } from "zod";
import { usersCollection } from "@/lib/db/collections";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { publicUser } from "@/lib/auth/guards";
import { handler, json, readJson, unauthorized } from "@/lib/http";

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const POST = handler(async (request) => {
  const { email, password } = await readJson(request, LoginBody);
  const normalizedEmail = email.toLowerCase().trim();

  const users = await usersCollection();
  const user = await users.findOne({ email: normalizedEmail }).lean();
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw unauthorized("Invalid email or password");
  }

  await createSession(user._id, request.headers.get("user-agent") ?? undefined);
  return json({ user: publicUser(user) });
});
