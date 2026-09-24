import { createSession } from "@/lib/auth/session";
import { publicUser } from "@/lib/auth/guards";
import { authenticate, LoginInput } from "@/lib/auth/credentials";
import { handler, json, readJson, unauthorized } from "@/lib/http";

/** JSON login for scripts/curl. The app itself uses `loginAction`. */
export const POST = handler(async (request) => {
  const { email, password } = await readJson(request, LoginInput);
  const user = await authenticate(email, password);
  if (!user) throw unauthorized("Invalid email or password");

  await createSession(user._id, request.headers.get("user-agent") ?? undefined);
  return json({ user: publicUser(user) });
});
