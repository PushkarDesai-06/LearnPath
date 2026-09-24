import { createSession } from "@/lib/auth/session";
import { publicUser } from "@/lib/auth/guards";
import { register, SignupInput } from "@/lib/auth/credentials";
import { conflict, handler, json, readJson } from "@/lib/http";

/** JSON signup for scripts/curl. The app itself uses `signupAction`. */
export const POST = handler(async (request) => {
  const body = await readJson(request, SignupInput);
  const user = await register(body);
  if (!user) throw conflict("An account with this email already exists");

  await createSession(user._id, request.headers.get("user-agent") ?? undefined);
  return json({ user: publicUser(user) }, 201);
});
