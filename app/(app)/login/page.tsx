import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current";
import { LoginForm } from "./LoginForm";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Log in" };

/**
 * Nothing to log into with a live session — send them to their studies.
 * `?mode=signup` opens the sign-up form (the landing page's "Get started").
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const { mode } = await searchParams;
  if (await getCurrentUser()) redirect("/topics");
  return <LoginForm key={mode === "signup" ? "signup" : "login"} initialMode={mode === "signup" ? "signup" : "login"} />;
}
