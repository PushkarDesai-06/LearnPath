"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";
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
interface Module {
  id: string;
  title: string;
  summary: string;
  status: string;
  lessons: Lesson[];
}
interface Curriculum {
  id: string;
  title: string;
  version: number;
  modules: Module[];
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

function CurriculumInner() {
  const router = useRouter();
  const topicId = useSearchParams().get("id");
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let active = true;
    const q = topicId ? `?curriculumId=${topicId}` : "";
    api<{ curriculum: Curriculum }>(`/api/curriculum${q}`)
      .then((res) => active && setCurriculum(res.curriculum))
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiClientError && err.status === 401) {
          router.push("/login");
          return;
        }
        if (!(err instanceof ApiClientError && err.status === 404))
          toast.error(err instanceof Error ? err.message : "Failed");
        setCurriculum(null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [router, topicId]);

  async function generate() {
    setGenerating(true);
    const t = toast.loading("Generating your curriculum…");
    try {
      const res = await api<{ curriculum: Curriculum }>(
        "/api/curriculum/generate",
        { method: "POST" },
      );
      setCurriculum(res.curriculum);
      toast.success("Curriculum generated!", { id: t });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed", {
        id: t,
      });
    } finally {
      setGenerating(false);
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );

  if (!curriculum)
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Your learning path</CardTitle>
          <CardDescription>
            No curriculum yet. Generate one from your completed assessment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={generate} disabled={generating} className="self-start">
            {generating && <Spinner data-icon="inline-start" />}
            Generate curriculum
          </Button>
        </CardContent>
      </Card>
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{curriculum.title}</h1>
          <p className="text-muted-foreground text-xs">
            version {curriculum.version}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/tutor?id=${curriculum.id}`}>Tutor</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/topics">Topics</Link>
          </Button>
        </div>
      </div>

      {curriculum.modules.map((m) => (
        <Card key={m.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-lg">
              <span>{m.title}</span>
              <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
            </CardTitle>
            <CardDescription>{m.summary}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {m.lessons.map((l) => {
              const locked = m.status === "locked";
              return (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
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
                      <Badge variant={statusVariant(l.status)}>{l.status}</Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {l.difficultyLevel} · ~{l.estMinutes} min
                    </p>
                    <Progress value={l.masteryScore * 100} className="max-w-40" />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function CurriculumPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CurriculumInner />
    </Suspense>
  );
}
