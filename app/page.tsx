"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { Button, Card, Spinner } from "@/components/ui";

interface Me {
  user: { email: string };
  onboarding: { status: string } | null;
}

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api<Me>("/api/me")
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  if (!me) {
    return (
      <Card className="space-y-4 text-center">
        <h1 className="text-2xl font-bold">🎓 LearnPath</h1>
        <p className="text-gray-600 dark:text-gray-300">
          An adaptive learning platform that diagnoses your level, generates a
          personalized curriculum, and adapts as you learn.
        </p>
        <Button onClick={() => router.push("/login")}>Get started</Button>
      </Card>
    );
  }

  const status = me.onboarding?.status;
  const next =
    !status || status === "clarifying"
      ? { href: "/onboarding", label: "Continue onboarding" }
      : status === "ready" || status === "assessing"
        ? { href: "/assessment", label: "Continue assessment" }
        : { href: "/dashboard", label: "Go to dashboard" };

  return (
    <Card className="space-y-4">
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="text-gray-600 dark:text-gray-300">
        Onboarding status: <strong>{status ?? "not started"}</strong>
      </p>
      <div className="flex gap-3">
        <Button onClick={() => router.push(next.href)}>{next.label}</Button>
        <Button variant="secondary" onClick={() => router.push("/dashboard")}>
          Dashboard
        </Button>
      </div>
    </Card>
  );
}
