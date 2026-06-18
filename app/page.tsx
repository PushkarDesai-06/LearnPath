"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
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
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 py-12 sm:py-20">
      <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
        Adaptive learning, paced for you
      </p>
      <h1 className="h-display text-4xl sm:text-5xl">
        A path drawn from where{" "}
        <span className="text-primary">you actually are.</span>
      </h1>
      <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
        Describe what you want to learn. LearnPath diagnoses your level with
        a short adaptive quiz, generates a curriculum that respects what you
        already know, and reorders itself as your mastery shifts. A Socratic
        tutor stays beside you — guiding, never handing over the answer.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={() => router.push("/login")}>
          Get started
          <ArrowRight data-icon="inline-end" />
        </Button>
        <span className="text-muted-foreground font-mono text-xs">
          Sign in to pick up where you left off.
        </span>
      </div>

      {/* Three quiet pillars */}
      <ul className="border-border mt-6 grid gap-x-8 gap-y-6 border-t pt-8 sm:grid-cols-3">
        {[
          {
            n: "01",
            t: "Diagnose",
            d: "A short adaptive quiz finds your actual level — no guessing.",
          },
          {
            n: "02",
            t: "Generate",
            d: "Modules and lessons are written for you, in the right order.",
          },
          {
            n: "03",
            t: "Adapt",
            d: "Mastery moves the path. Review surfaces what you forget.",
          },
        ].map((p) => (
          <li key={p.n} className="flex flex-col gap-2">
            <span className="text-muted-foreground/60 font-mono text-[10px] tracking-[0.16em]">
              {p.n}
            </span>
            <span className="font-medium">{p.t}</span>
            <span className="text-muted-foreground text-sm leading-relaxed">
              {p.d}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
