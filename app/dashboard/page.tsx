"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, ArrowUpRight } from "lucide-react";
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
import { TrailRail } from "@/components/TrailRail";
import { formatStatus, statusTone } from "@/lib/format";

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
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  if (!data) return null;

  if (!data.hasCurriculum)
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle className="h-display text-3xl">Nothing here yet</CardTitle>
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
  const railItems = (data.modules ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    status: m.status,
  }));
  const currentModule =
    data.modules?.find((m) => m.status === "in_progress")?.id ??
    data.modules?.find((m) => m.status === "available")?.id ??
    null;

  return (
    <div className="grid gap-10 lg:grid-cols-[180px_1fr]">
      <TrailRail items={railItems} activeId={currentModule} />

      <div className="flex flex-col gap-8">
        {/* Hero */}
        <header className="flex flex-col gap-3">
          <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
            Your path
          </p>
          <div className="flex items-end justify-between gap-4">
            <h1 className="h-display text-3xl sm:text-4xl">{data.title}</h1>
            <div className="flex shrink-0 gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/tutor?id=${data.curriculumId}`}>Tutor</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/topics">All topics</Link>
              </Button>
            </div>
          </div>
        </header>

        {/* Instrument-panel stats */}
        <section className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-border py-5 sm:grid-cols-4">
          <Stat
            label="Mastery"
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
        </section>

        {/* Recommended next */}
        {data.recommendedNext && (
          <Link
            href={`/learn/${data.recommendedNext.lessonId}`}
            className="group bg-surface-2/40 ring-primary/15 hover:ring-primary/35 relative block overflow-hidden rounded-2xl border border-primary/20 p-5 ring-1 transition-all"
          >
            <div className="bg-primary/8 absolute -right-12 -top-12 size-40 rounded-full blur-3xl" />
            <p className="text-primary/90 font-mono text-[10px] uppercase tracking-[0.18em]">
              {data.recommendedNext.reason === "needs_review"
                ? "Pick up a review"
                : "Pick up where you left off"}
            </p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <p className="text-lg font-medium leading-tight">
                  {data.recommendedNext.lessonTitle}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  in {data.recommendedNext.moduleTitle}
                </p>
              </div>
              <ArrowUpRight className="text-primary size-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </Link>
        )}

        {/* Modules */}
        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
            Modules
          </h2>
          {data.modules!.map((m, idx) => {
            const locked = m.status === "locked";
            return (
              <Card
                key={m.id}
                id={`mod-${m.id}`}
                className="scroll-mt-24 transition-colors hover:border-border/60"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-baseline gap-3">
                      <span className="text-muted-foreground/60 font-mono text-xs tabular-nums">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <CardTitle className="text-lg font-medium">
                        {m.title}
                      </CardTitle>
                    </div>
                    <Badge variant="status" tone={statusTone(m.status)}>
                      {formatStatus(m.status)}
                    </Badge>
                  </div>
                  <CardDescription className="ml-9">
                    {m.summary}
                  </CardDescription>
                </CardHeader>
                <CardContent className="ml-9 flex flex-col gap-2.5">
                  {m.lessons.map((l) => {
                    const lt = statusTone(l.status);
                    return (
                      <div
                        key={l.id}
                        className="hover:bg-surface-2/40 flex flex-col gap-1.5 rounded-md border border-transparent px-3 py-2.5 transition-colors hover:border-border/40"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 truncate">
                            {locked ? (
                              <span className="text-muted-foreground flex items-center gap-2 text-sm">
                                <Lock className="size-3.5 shrink-0" />
                                {l.title}
                              </span>
                            ) : (
                              <Link
                                href={`/learn/${l.id}`}
                                className="hover:text-primary text-sm font-medium transition-colors"
                              >
                                {l.title}
                              </Link>
                            )}
                            <Badge variant="status" tone={lt}>
                              {formatStatus(l.status)}
                            </Badge>
                          </div>
                          <span className="text-muted-foreground/80 shrink-0 font-mono text-[10px] tabular-nums">
                            ~{l.estMinutes}m
                          </span>
                        </div>
                        <Progress
                          value={l.masteryScore * 100}
                          className="max-w-40"
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </section>

        {s.lessonsNeedingReview > 0 && (
          <p className="text-tone-review text-sm">
            {s.lessonsNeedingReview} lesson
            {s.lessonsNeedingReview === 1 ? "" : "s"} flagged for review.
          </p>
        )}
      </div>
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

export default function DashboardPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <DashboardInner />
    </Suspense>
  );
}
