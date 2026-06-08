"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { Button, Card, ErrorText } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "signup") {
        await api("/api/auth/signup", {
          body: { email, password, displayName: displayName || undefined },
        });
        router.push("/onboarding");
      } else {
        await api("/api/auth/login", { body: { email, password } });
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-bold">
        {mode === "login" ? "Log in" : "Create account"}
      </h1>
      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && (
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            placeholder="Display name (optional)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        )}
        <input
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
          type="password"
          required
          minLength={mode === "signup" ? 8 : undefined}
          placeholder={mode === "signup" ? "Password (min 8 chars)" : "Password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "…" : mode === "login" ? "Log in" : "Sign up"}
        </Button>
      </form>
      <p className="text-center text-sm text-gray-500">
        {mode === "login" ? "No account?" : "Have an account?"}{" "}
        <button
          className="text-blue-600 hover:underline"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError("");
          }}
        >
          {mode === "login" ? "Sign up" : "Log in"}
        </button>
      </p>
    </Card>
  );
}
