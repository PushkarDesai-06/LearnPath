"use server";

/**
 * Auth as Server Actions. Setting the session cookie, navigating, and
 * re-rendering the root layout (so the Nav shows the new identity) happen in a
 * single round trip. `redirect()` throws, so it always sits OUTSIDE any
 * try/catch; recoverable failures are returned as `{ error }` state for
 * `useActionState`.
 */
import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth/session";
import {
  authenticate,
  LoginInput,
  register,
  SignupInput,
} from "@/lib/auth/credentials";

export interface AuthFormState {
  error: string | null;
}

async function userAgent() {
  return (await headers()).get("user-agent") ?? undefined;
}

const field = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
};

export async function loginAction(
  _prev: AuthFormState,
  form: FormData,
): Promise<AuthFormState> {
  const parsed = LoginInput.safeParse({
    email: field(form, "email"),
    password: field(form, "password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) return { error: "Invalid email or password" };

  await createSession(user._id, await userAgent());
  redirect("/topics");
}

export async function signupAction(
  _prev: AuthFormState,
  form: FormData,
): Promise<AuthFormState> {
  const displayName = field(form, "displayName").trim();
  const parsed = SignupInput.safeParse({
    email: field(form, "email"),
    password: field(form, "password"),
    displayName: displayName || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  const user = await register(parsed.data);
  if (!user) return { error: "An account with this email already exists" };

  await createSession(user._id, await userAgent());
  redirect("/onboarding?new=1");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
