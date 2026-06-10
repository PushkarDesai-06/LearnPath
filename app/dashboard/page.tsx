"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/client/api";
import { Badge, Button, Card, ProgressBar, Spinner } from "@/components/ui";

interface Progress {
  hasCurriculum: boolean;
  curriculumId?: string;
  title?: string;
  version?: number;
  summary?: {
    modulesTotal: number;
    modulesCompleted: number;
    lessonsTotal: number;
    lessonsMastered: number;
    lessonsNeedingReview: number;
    overallMastery: number;
    totalTimeMs: number;
  };
  modules?: {
    id: string;
    title: string;
    status: string;
    lessonsTotal: number;
    lessonsMastered: number;
    mastery: number;
  }[];
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
  const [data, setData] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const q = topicId ? `?curriculumId=${topicId}` : "";
    api<Progress>(`/api/progress${q}`)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active && err instanceof ApiClientError && err.status === 401) {
          router.push("/login");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router, topicId]);

  if (loading) return <Spinner />;
  if (!data) return null;

  if (!data.hasCurriculum) {
    return (
      <Card className="space-y-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          No topic to show yet.
        </p>
        <Button onClick={() => router.push("/topics")}>Go to topics</Button>
      </Card>
    );
  }

  const s = data.summary!;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold">{data.title}</h1>
        <div className="flex gap-3 text-sm">
          <Link
            href={`/curriculum?id=${data.curriculumId}`}
            className="text-blue-600 hover:underline"
          >
            Path
          </Link>
          <Link
            href={`/tutor?id=${data.curriculumId}`}
            className="text-blue-600 hover:underline"
          >
            Tutor
          </Link>
          <Link href="/topics" className="text-blue-600 hover:underline">
            ← Topics
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Overall mastery" value={`${Math.round(s.overallMastery * 100)}%`} />
        <Stat label="Lessons mastered" value={`${s.lessonsMastered}/${s.lessonsTotal}`} />
        <Stat label="Modules done" value={`${s.modulesCompleted}/${s.modulesTotal}`} />
        <Stat label="Time spent" value={fmtTime(s.totalTimeMs)} />
      </div>

      {data.recommendedNext && (
        <Card className="space-y-2 border-blue-300">
          <p className="text-xs font-semibold uppercase text-blue-500">
            Recommended next ·{" "}
            {data.recommendedNext.reason === "needs_review"
              ? "review"
              : "keep going"}
          </p>
          <p className="font-medium">{data.recommendedNext.lessonTitle}</p>
          <p className="text-xs text-gray-400">
            in {data.recommendedNext.moduleTitle}
          </p>
          <Link
            href={`/learn/${data.recommendedNext.lessonId}`}
            className="text-sm text-blue-600 hover:underline"
          >
            Open lesson →
          </Link>
        </Card>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Progress map</h2>
        {data.modules!.map((m) => (
          <Card key={m.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">{m.title}</span>
              <Badge
                tone={
                  m.status === "completed"
                    ? "green"
                    : m.status === "locked"
                      ? "gray"
                      : "blue"
                }
              >
                {m.status}
              </Badge>
            </div>
            <ProgressBar value={m.mastery} />
            <p className="text-xs text-gray-400">
              {m.lessonsMastered}/{m.lessonsTotal} lessons mastered ·{" "}
              {Math.round(m.mastery * 100)}% mastery
            </p>
          </Card>
        ))}
      </div>

      {s.lessonsNeedingReview > 0 && (
        <p className="text-sm text-red-600">
          {s.lessonsNeedingReview} lesson(s) need review.
        </p>
      )}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </Card>
  );
}
