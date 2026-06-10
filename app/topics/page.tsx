"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client/api";
import { Badge, Button, Card, ProgressBar, Spinner } from "@/components/ui";

interface Topic {
  id: string;
  title: string;
  domain: string;
  version: number;
  summary: {
    modulesTotal: number;
    modulesCompleted: number;
    lessonsTotal: number;
    lessonsMastered: number;
    overallMastery: number;
  };
}
interface InProgress {
  onboardingId: string;
  topic: string;
  status: string;
  next: "onboarding" | "assessment";
}

export default function TopicsPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [inProgress, setInProgress] = useState<InProgress[]>([]);

  useEffect(() => {
    let active = true;
    api<{ topics: Topic[]; inProgress: InProgress[] }>("/api/topics")
      .then((res) => {
        if (!active) return;
        setTopics(res.topics);
        setInProgress(res.inProgress ?? []);
      })
      .catch((err) => {
        if (active && err instanceof ApiClientError && err.status === 401) {
          router.push("/login");
        } else if (active) {
          setTopics([]);
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (!topics) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your topics</h1>
        <Button onClick={() => router.push("/onboarding?new=1")}>
          + New topic
        </Button>
      </div>

      {inProgress.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500">In progress</h2>
          {inProgress.map((p) => (
            <Card
              key={p.onboardingId}
              className="flex items-center justify-between gap-3"
            >
              <div>
                <p className="font-medium">{p.topic}</p>
                <p className="text-xs text-gray-400">
                  {p.status === "clarifying"
                    ? "Onboarding not finished"
                    : "Assessment not finished"}
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  router.push(p.next === "onboarding" ? "/onboarding" : "/assessment")
                }
              >
                Continue
              </Button>
            </Card>
          ))}
        </div>
      )}

      {topics.length === 0 ? (
        <Card className="space-y-3 text-center">
          <p className="text-gray-600 dark:text-gray-300">
            You don&apos;t have any topics yet. Each topic is its own learning
            path — e.g. &ldquo;Node.js&rdquo; and &ldquo;English grammar&rdquo;
            can run side by side.
          </p>
          <Button onClick={() => router.push("/onboarding?new=1")}>
            Start your first topic
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {topics.map((t) => (
            <Card key={t.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{t.title}</h2>
                  <p className="text-xs text-gray-400">{t.domain}</p>
                </div>
                <Badge tone="blue">
                  {Math.round(t.summary.overallMastery * 100)}%
                </Badge>
              </div>
              <ProgressBar value={t.summary.overallMastery} />
              <p className="text-xs text-gray-400">
                {t.summary.lessonsMastered}/{t.summary.lessonsTotal} lessons ·{" "}
                {t.summary.modulesCompleted}/{t.summary.modulesTotal} modules
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <Link
                  href={`/dashboard?id=${t.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Dashboard
                </Link>
                <Link
                  href={`/curriculum?id=${t.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Path
                </Link>
                <Link
                  href={`/tutor?id=${t.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Tutor
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
