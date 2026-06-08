"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/client/api";
import { Badge, Button, Card, ErrorText, Spinner } from "@/components/ui";

interface Block {
  kind: "text" | "code" | "analogy" | "example" | "practice";
  markdown?: string;
  language?: string;
  code?: string;
  caption?: string;
  questionId?: string;
  prompt?: string;
  type?: "mcq" | "short";
  choices?: string[] | null;
}
interface LessonResp {
  lesson: {
    id: string;
    curriculumId: string;
    title: string;
    blocks: Block[];
  };
}

function PracticeBlock({ block }: { block: Block }) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    correct: boolean;
    feedback: string | null;
    explanation: string | null;
    masteryScore: number;
  } | null>(null);
  const params = useParams<{ lessonId: string }>();

  async function submit() {
    setBusy(true);
    try {
      const res = await api<typeof result>(
        `/api/lesson/${params.lessonId}/practice`,
        { body: { questionId: block.questionId, answer } },
      );
      setResult(res);
    } catch {
      // keep simple
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/30">
      <p className="text-xs font-semibold uppercase text-blue-500">Practice</p>
      <p className="font-medium">{block.prompt}</p>
      {block.type === "mcq" && block.choices ? (
        <div className="space-y-2">
          {block.choices.map((c, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={block.questionId}
                value={String(i)}
                checked={answer === String(i)}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={!!result}
              />
              {c}
            </label>
          ))}
        </div>
      ) : (
        <textarea
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
          rows={2}
          value={answer}
          disabled={!!result}
          onChange={(e) => setAnswer(e.target.value)}
        />
      )}
      {!result ? (
        <Button onClick={submit} disabled={busy || !answer.trim()}>
          {busy ? "Checking…" : "Check answer"}
        </Button>
      ) : (
        <div className="space-y-1 text-sm">
          <Badge tone={result.correct ? "green" : "red"}>
            {result.correct ? "Correct" : "Not quite"}
          </Badge>
          {result.feedback && <p>{result.feedback}</p>}
          {result.explanation && (
            <p className="text-gray-600 dark:text-gray-300">
              <strong>Explanation:</strong> {result.explanation}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

export default function LessonPage() {
  const params = useParams<{ lessonId: string }>();
  const router = useRouter();
  const [data, setData] = useState<LessonResp["lesson"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    api<LessonResp>(`/api/lesson/${params.lessonId}`)
      .then((res) => {
        if (active) setData(res.lesson);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiClientError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load lesson");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.lessonId, router]);

  async function markComplete() {
    if (!data) return;
    setCompleting(true);
    try {
      await api("/api/progress/complete", {
        body: {
          curriculumId: data.curriculumId,
          lessonRef: data.id,
          timeSpentMs: Date.now() - startedAt,
        },
      });
      setCompleted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setCompleting(false);
    }
  }

  if (loading) return <Spinner label="Generating your lesson…" />;
  if (error && !data) return <ErrorText>{error}</ErrorText>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{data.title}</h1>
        <Link href="/curriculum" className="text-sm text-blue-600 hover:underline">
          ← Path
        </Link>
      </div>

      {data.blocks.map((b, i) => {
        if (b.kind === "practice")
          return <PracticeBlock key={b.questionId ?? i} block={b} />;
        if (b.kind === "code")
          return (
            <Card key={i} className="space-y-1">
              {b.caption && (
                <p className="text-xs text-gray-400">{b.caption}</p>
              )}
              <pre className="overflow-x-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100">
                <code>{b.code}</code>
              </pre>
            </Card>
          );
        return (
          <Card key={i}>
            {b.kind !== "text" && (
              <p className="mb-1 text-xs font-semibold uppercase text-gray-400">
                {b.kind}
              </p>
            )}
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {b.markdown}
            </p>
          </Card>
        );
      })}

      <Card className="flex items-center justify-between">
        {completed ? (
          <>
            <Badge tone="green">Lesson completed ✓</Badge>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => router.push("/curriculum")}>
                Back to path
              </Button>
              <Button onClick={() => router.push("/dashboard")}>Dashboard</Button>
            </div>
          </>
        ) : (
          <>
            <span className="text-sm text-gray-500">
              Finished reading and practicing?
            </span>
            <Button onClick={markComplete} disabled={completing}>
              {completing ? "Saving…" : "Mark complete"}
            </Button>
          </>
        )}
      </Card>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
