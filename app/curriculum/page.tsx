"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/client/api";
import { Badge, Button, Card, ErrorText, ProgressBar, Spinner } from "@/components/ui";

interface Lesson {
  id: string;
  title: string;
  status: string;
  difficultyLevel: string;
  estMinutes: number;
  masteryScore: number;
  topics: string[];
}
interface Module {
  id: string;
  title: string;
  summary: string;
  status: string;
  prerequisites: string[];
  lessons: Lesson[];
}
interface Curriculum {
  id: string;
  title: string;
  version: number;
  modules: Module[];
}

function statusTone(status: string) {
  switch (status) {
    case "mastered":
    case "completed":
      return "green" as const;
    case "needs_review":
      return "red" as const;
    case "in_progress":
      return "yellow" as const;
    case "locked":
      return "gray" as const;
    default:
      return "blue" as const;
  }
}

function CurriculumInner() {
  const router = useRouter();
  const topicId = useSearchParams().get("id");
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const q = topicId ? `?curriculumId=${topicId}` : "";
    api<{ curriculum: Curriculum }>(`/api/curriculum${q}`)
      .then((res) => {
        if (active) setCurriculum(res.curriculum);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiClientError && err.status === 401) {
          router.push("/login");
          return;
        }
        // 404 = no curriculum yet; not an error to show loudly
        if (!(err instanceof ApiClientError && err.status === 404)) {
          setError(err instanceof Error ? err.message : "Failed");
        }
        setCurriculum(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router, topicId]);

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const res = await api<{ curriculum: Curriculum }>(
        "/api/curriculum/generate",
        { method: "POST" },
      );
      setCurriculum(res.curriculum);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <Spinner />;

  if (!curriculum) {
    return (
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold">Your learning path</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          No curriculum yet. Generate one from your completed assessment.
        </p>
        <ErrorText>{error}</ErrorText>
        <Button onClick={generate} disabled={generating}>
          {generating ? "Generating…" : "Generate curriculum"}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{curriculum.title}</h1>
          <p className="text-xs text-gray-400">version {curriculum.version}</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href={`/tutor?id=${curriculum.id}`} className="text-blue-600 hover:underline">
            Tutor
          </Link>
          <Link href="/topics" className="text-blue-600 hover:underline">
            ← Topics
          </Link>
        </div>
      </div>
      {curriculum.modules.map((m) => (
        <Card key={m.id} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{m.title}</h2>
            <Badge tone={statusTone(m.status)}>{m.status}</Badge>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">{m.summary}</p>
          <ul className="space-y-2">
            {m.lessons.map((l) => {
              const locked = m.status === "locked";
              return (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-gray-100 px-3 py-2 dark:border-gray-800"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {locked ? (
                        <span className="text-sm font-medium text-gray-400">
                          🔒 {l.title}
                        </span>
                      ) : (
                        <Link
                          href={`/learn/${l.id}`}
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          {l.title}
                        </Link>
                      )}
                      <Badge tone={statusTone(l.status)}>{l.status}</Badge>
                    </div>
                    <p className="text-xs text-gray-400">
                      {l.difficultyLevel} · ~{l.estMinutes} min
                    </p>
                    <div className="mt-1 max-w-[160px]">
                      <ProgressBar value={l.masteryScore} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
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
