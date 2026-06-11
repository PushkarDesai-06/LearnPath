"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export default function Home() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    api("/api/me")
      .then(() => active && router.replace("/topics"))
      .catch((err) => {
        if (active && err instanceof ApiClientError) setLoggedIn(false);
        else if (active) setLoggedIn(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (loggedIn === null)
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );

  return (
    <Card className="mx-auto max-w-md text-center">
      <CardHeader>
        <div className="bg-primary/10 mx-auto flex size-12 items-center justify-center rounded-full">
          <GraduationCap className="text-primary size-6" />
        </div>
        <CardTitle className="text-2xl">LearnPath</CardTitle>
        <CardDescription>
          An adaptive learning platform that diagnoses your level, generates a
          personalized curriculum, and adapts as you learn, across as many
          topics as you want.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button size="lg" onClick={() => router.push("/login")}>
          Get started
        </Button>
      </CardContent>
    </Card>
  );
}
