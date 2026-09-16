"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LogOut, Plus } from "lucide-react";
import { api, ApiClientError } from "@/lib/client/api";
import { useSession } from "@/components/SessionProvider";
import { initials } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Topic {
  id: string;
  title: string;
  summary: {
    modulesTotal: number;
    modulesCompleted: number;
    lessonsTotal: number;
    lessonsMastered: number;
    overallMastery: number;
  };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

// Layout-matched loading state — identity row, stat strip, then the cards.
function AccountSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex items-center gap-4">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-48" />
        </div>
      </header>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-border py-5 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-56" />
          </CardHeader>
          <CardFooter>
            <Skeleton className="h-8 w-24 rounded-lg" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const { me, signOut } = useSession();
  // Topics double as the account's learning rollup, so no extra endpoint.
  const [topics, setTopics] = useState<Topic[] | null>(null);

  useEffect(() => {
    let active = true;
    api<{ topics: Topic[] }>("/api/topics")
      .then((res) => active && setTopics(res.topics))
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiClientError && err.status === 401)
          router.push("/login");
        else setTopics([]);
      });
    return () => {
      active = false;
    };
  }, [router]);

  // The session resolving to null means signed out — /api/topics 401s and the
  // effect above redirects, so just hold the skeleton until it does.
  if (!me || !topics) return <AccountSkeleton />;

  const { email, displayName, createdAt } = me;
  const totals = topics.reduce(
    (acc, t) => ({
      lessonsMastered: acc.lessonsMastered + t.summary.lessonsMastered,
      lessonsTotal: acc.lessonsTotal + t.summary.lessonsTotal,
      modulesCompleted: acc.modulesCompleted + t.summary.modulesCompleted,
      modulesTotal: acc.modulesTotal + t.summary.modulesTotal,
      mastery: acc.mastery + t.summary.overallMastery,
    }),
    {
      lessonsMastered: 0,
      lessonsTotal: 0,
      modulesCompleted: 0,
      modulesTotal: 0,
      mastery: 0,
    },
  );
  // Mean of the per-topic averages — every topic counts the same, regardless of
  // how many lessons it happens to hold.
  const avgMastery =
    topics.length > 0 ? Math.round((totals.mastery / topics.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-10">
      {/* Hero */}
      <header className="flex items-center gap-4">
        <Avatar size="lg">
          <AvatarFallback className="font-medium">
            {initials(email, displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
            Account
          </p>
          <h1 className="h-display truncate text-3xl sm:text-4xl">
            {displayName || email.split("@")[0]}
          </h1>
        </div>
      </header>

      {/* Instrument-panel stats — same strip the dashboard uses, across topics */}
      <section className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-border py-5 sm:grid-cols-4">
        <Stat label="Topics" value={String(topics.length)} />
        <Stat
          label="Lessons mastered"
          value={`${totals.lessonsMastered}/${totals.lessonsTotal}`}
        />
        <Stat
          label="Modules done"
          value={`${totals.modulesCompleted}/${totals.modulesTotal}`}
        />
        <Stat label="Avg mastery" value={`${avgMastery}%`} />
      </section>

      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Details</CardTitle>
          <CardDescription>
            How LearnPath knows you. Get in touch to change your email.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Detail label="Email" value={email} mono />
          <Detail label="Display name" value={displayName || "Not set"} />
          <Detail label="Member since" value={fmtDate(createdAt)} />
        </CardContent>
      </Card>

      {/* Studies */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Your studies</CardTitle>
          <CardDescription>
            {topics.length === 0
              ? "No topics yet — describe a goal and LearnPath builds the path."
              : `${topics.length} ${topics.length === 1 ? "topic" : "topics"} on your shelf.`}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex gap-1">
          {topics.length === 0 ? (
            <Button asChild>
              <Link href="/onboarding?new=1">
                <Plus data-icon="inline-start" />
                New topic
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" asChild>
              <Link href="/topics">
                All topics
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Session */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Session</CardTitle>
          <CardDescription>
            Signing out ends this session on this device.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="destructive" onClick={signOut}>
            <LogOut data-icon="inline-start" />
            Log out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-mono text-2xl font-normal tabular-nums">{value}</p>
      <p className="text-muted-foreground/80 font-mono text-[10px] uppercase tracking-[0.16em]">
        {label}
      </p>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-muted-foreground/80 font-mono text-[10px] uppercase tracking-[0.16em]">
        {label}
      </p>
      <p className={mono ? "truncate font-mono text-sm" : "truncate text-sm"}>
        {value}
      </p>
    </div>
  );
}
