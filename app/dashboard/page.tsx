"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";

interface Lesson {
  id: string;
  title: string;
  status: string;
  difficultyLevel: string;
  estMinutes: number;
  masteryScore: number;
}
interface ModuleData {
  id: string;
  title: string;
  summary: string;
  status: string;
  lessonsTotal: number;
  lessonsMastered: number;
  mastery: number;
  lessons: Lesson[];
}
interface ProgressData {
  hasCurriculum: boolean;
  curriculumId?: string;
  title?: string;
  summary?: {
    modulesTotal: number;
    modulesCompleted: number;
    lessonsTotal: number;
    lessonsMastered: number;
    lessonsNeedingReview: number;
    overallMastery: number;
    totalTimeMs: number;
  };
  modules?: ModuleData[];
  recommendedNext?: {
    reason: string;
    moduleTitle: string;
    lessonId: string;
    lessonTitle: string;
  } | null;
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";
function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case "mastered":
    case "completed":
      return "default";
    case "needs_review":
      return "destructive";
    case "locked":
      return "outline";
    default:
      return "secondary";
  }
}

function fmtTime(ms: number) {
  const min = Math.round(ms / 60000);
  return min < 1 ? "<1 min" : `${min} min`;
}

function DashboardInner() {
  const router = useRouter();
  const topicId = useSearchParams().get("id");
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const q = topicId ? `?curriculumId=${topicId}` : "";
    api<ProgressData>(`/api/progress${q}`)
      .then((res) => active && setData(res))
      .catch((err) => {
        if (active && err instanceof ApiClientError && err.status === 401)
          router.push("/login");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [router, topicId]);

  if (loading)
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  if (!data) return null;

  if (!data.hasCurriculum)
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Nothing here yet</CardTitle>
          <CardDescription>
            This topic doesn&apos;t have a learning path yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push("/topics")}>Go to topics</Button>
        </CardContent>
      </Card>
    );

  const s = data.summary!;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold">{data.title}</h1>
        <div className="flex gap-1">
          <Button variant="link" size="sm" asChild>
            <Link href={`/tutor?id=${data.curriculumId}`}>Tutor</Link>
          </Button>
          <Button variant="link" size="sm" asChild>
            <Link href="/topics">Topics</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Overall mastery"
          value={`${Math.round(s.overallMastery * 100)}%`}
        />
        <Stat
          label="Lessons mastered"
          value={`${s.lessonsMastered}/${s.lessonsTotal}`}
        />
        <Stat
          label="Modules done"
          value={`${s.modulesCompleted}/${s.modulesTotal}`}
        />
        <Stat label="Time spent" value={fmtTime(s.totalTimeMs)} />
      </div>

      {data.recommendedNext && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardDescription className="text-primary text-xs font-semibold uppercase">
              Recommended next ·{" "}
              {data.recommendedNext.reason === "needs_review"
                ? "review"
                : "keep going"}
            </CardDescription>
            <CardTitle className="text-base">
              {data.recommendedNext.lessonTitle}
            </CardTitle>
            <p className="text-muted-foreground text-xs">
              in {data.recommendedNext.moduleTitle}
            </p>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/learn/${data.recommendedNext.lessonId}`}>
                Open lesson
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Learning path</h2>
        {data.modules!.map((m) => {
          const locked = m.status === "locked";
          return (
            <Card key={m.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-lg">
                  <span>{m.title}</span>
                  <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
                </CardTitle>
                <CardDescription>{m.summary}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {m.lessons.map((l) => (
                  <div
                    key={l.id}
                    className="flex flex-col gap-1 rounded-md border p-3"
                  >
                    <div className="flex items-center gap-2">
                      {locked ? (
                        <span className="text-muted-foreground flex items-center gap-1 text-sm font-medium">
                          <Lock className="size-3.5" />
                          {l.title}
                        </span>
                      ) : (
                        <Link
                          href={`/learn/${l.id}`}
                          className="text-primary text-sm font-medium hover:underline"
                        >
                          {l.title}
                        </Link>
                      )}
                      <Badge variant={statusVariant(l.status)}>
                        {l.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {l.difficultyLevel} · ~{l.estMinutes} min
                    </p>
                    <Progress
                      value={l.masteryScore * 100}
                      className="max-w-40"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {s.lessonsNeedingReview > 0 && (
        <p className="text-destructive text-sm">
          {s.lessonsNeedingReview} lesson(s) need review.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="text-center">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-muted-foreground text-xs">{label}</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <DashboardInner />
    </Suspense>
  );
}
