import { destroySession } from "@/lib/auth/session";
import { handler, json } from "@/lib/http";

export const POST = handler(async () => {
  await destroySession();
  return json({ ok: true });
});
