"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Plus } from "lucide-react";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

interface Topic {
  id: string;
  title: string;
  domain: string;
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
        if (active && err instanceof ApiClientError && err.status === 401)
          router.push("/login");
        else if (active) setTopics([]);
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (!topics)
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your topics</h1>
        <Button asChild>
          <Link href="/onboarding?new=1">
            <Plus data-icon="inline-start" />
            New topic
          </Link>
        </Button>
      </div>

      {inProgress.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-sm font-medium">
            In progress
          </h2>
          {inProgress.map((p) => (
            <Card key={p.onboardingId}>
              <CardContent className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{p.topic}</p>
                  <p className="text-muted-foreground text-xs">
                    {p.status === "clarifying"
                      ? "Onboarding not finished"
                      : "Assessment not finished"}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() =>
                    router.push(
                      p.next === "onboarding" ? "/onboarding" : "/assessment",
                    )
                  }
                >
                  Continue
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {topics.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpen />
            </EmptyMedia>
            <EmptyTitle>No topics yet</EmptyTitle>
            <EmptyDescription>Generate your learning path!</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/onboarding?new=1">Start your first topic</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {topics.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 truncate">
                  <span className="truncate">{t.title}</span>
                  <Badge variant="secondary">
                    {Math.round(t.summary.overallMastery * 100)}%
                  </Badge>
                </CardTitle>
                <p className="text-muted-foreground text-xs">{t.domain}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-end gap-2">
                <Progress value={t.summary.overallMastery * 100} />
                <p className="text-muted-foreground text-xs">
                  {t.summary.lessonsMastered}/{t.summary.lessonsTotal} lessons ·{" "}
                  {t.summary.modulesCompleted}/{t.summary.modulesTotal} modules
                </p>
              </CardContent>
              <CardFooter className="gap-1 flex justify-between">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/tutor?id=${t.id}`}>Tutor</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href={`/dashboard?id=${t.id}`}>Learn {" ->"}</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
