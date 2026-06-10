"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client/api";
import { Button, Card, Spinner } from "@/components/ui";

export default function Home() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    api("/api/me")
      .then(() => {
        // Logged in → go to the topics hub (the multi-topic home).
        if (active) router.replace("/topics");
      })
      .catch((err) => {
        if (active && err instanceof ApiClientError && err.status === 401) {
          setLoggedIn(false);
        } else if (active) {
          setLoggedIn(false);
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (loggedIn === null) return <Spinner />;

  return (
    <Card className="space-y-4 text-center">
      <h1 className="text-2xl font-bold">🎓 LearnPath</h1>
      <p className="text-gray-600 dark:text-gray-300">
        An adaptive learning platform that diagnoses your level, generates a
        personalized curriculum, and adapts as you learn — across as many topics
        as you want.
      </p>
      <Button onClick={() => router.push("/login")}>Get started</Button>
    </Card>
  );
}
