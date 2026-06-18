"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";

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
type Lesson = {
  id: string;
  curriculumId: string;
  title: string;
  blocks: Block[];
};
interface LessonResp {
  status: "ready" | "generating";
  lesson?: Lesson;
}

function PracticeBlock({ block }: { block: Block }) {
  const params = useParams<{ lessonId: string }>();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    correct: boolean;
    feedback: string | null;
    explanation: string | null;
  } | null>(null);

  async function submit() {
    setBusy(true);
    try {
      const res = await api<typeof result>(
        `/api/lesson/${params.lessonId}/practice`,
        { body: { questionId: block.questionId, answer } },
      );
      setResult(res);
      if (res?.correct) toast.success("Correct.");
      else toast.warning("Not quite. Read the explanation.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not grade answer",
      );
    } finally {
      setBusy(false);
    }
  }

  const edge = !result
    ? "border-primary/30"
    : result.correct
      ? "border-tone-mastered/50"
      : "border-tone-review/50";

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-l-4 transition-colors",
        edge,
      )}
    >
      <CardContent className="flex flex-col gap-3">
        <p className="text-primary font-mono text-[10px] uppercase tracking-[0.18em]">
          Practice
        </p>
        <p className="font-medium">{block.prompt}</p>
        {block.type === "mcq" && block.choices ? (
          <RadioGroup
            value={answer}
            onValueChange={setAnswer}
            disabled={!!result}
          >
            {block.choices.map((c, i) => (
              <Label
                key={i}
                htmlFor={`${block.questionId}-${i}`}
                className="hover:bg-surface-2/50 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 font-normal transition-colors"
              >
                <RadioGroupItem
                  value={String(i)}
                  id={`${block.questionId}-${i}`}
                />
                {c}
              </Label>
            ))}
          </RadioGroup>
        ) : (
          <Textarea
            rows={2}
            value={answer}
            disabled={!!result}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your answer…"
          />
        )}
        {!result ? (
          <Button
            size="sm"
            className="self-start"
            onClick={submit}
            disabled={busy || !answer.trim()}
          >
            {busy && <Spinner data-icon="inline-start" />}
            Check answer
          </Button>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <Badge
              variant="status"
              tone={result.correct ? "mastered" : "review"}
              className="self-start"
            >
              {result.correct ? "Correct" : "Not quite"}
            </Badge>
            {result.feedback && <p>{result.feedback}</p>}
            {result.explanation && (
              <div className="text-muted-foreground border-border/60 mt-1 border-l-2 pl-3">
                <p className="text-foreground/80 mb-1 text-xs font-medium uppercase tracking-wider">
                  Explanation
                </p>
                <Markdown>{result.explanation}</Markdown>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const POLL_MS = 2500;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

const BLOCK_LABELS: Record<string, string> = {
  analogy: "Analogy",
  example: "Example",
};

export default function LessonPage() {
  const params = useParams<{ lessonId: string }>();
  const router = useRouter();
  const [data, setData] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    const poll = () => {
      api<LessonResp>(`/api/lesson/${params.lessonId}`)
        .then((res) => {
          if (!active) return;
          if (res.status === "ready" && res.lesson) {
            setData(res.lesson);
            setLoading(false);
          } else if (Date.now() >= deadline) {
            setError("This is taking longer than expected.");
            setLoading(false);
          } else {
            timer = setTimeout(poll, POLL_MS);
          }
        })
        .catch((err) => {
          if (!active) return;
          if (err instanceof ApiClientError && err.status === 401) {
            router.push("/login");
            return;
          }
          setError(
            err instanceof Error ? err.message : "Failed to load lesson",
          );
          setLoading(false);
        });
    };
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [params.lessonId, router, attempt]);

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
      toast.success("Lesson complete. Path updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setCompleting(false);
    }
  }

  if (loading)
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <span className="bg-tone-generating/30 size-3 animate-pulse rounded-full" />
        <p className="text-foreground text-sm">Writing your lesson</p>
        <p className="text-muted-foreground text-xs">
          You can leave. It keeps generating in the background.
        </p>
      </div>
    );
  if (error && !data)
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          variant="secondary"
          onClick={() => {
            setError("");
            setLoading(true);
            setAttempt((a) => a + 1);
          }}
        >
          Retry
        </Button>
      </div>
    );
  if (!data) return null;

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6">
      <Button variant="ghost" size="sm" asChild className="self-start -ml-2">
        <Link href={`/dashboard?id=${data.curriculumId}`}>
          <ArrowLeft data-icon="inline-start" />
          Back to path
        </Link>
      </Button>
      <header className="flex flex-col gap-2">
        <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
          Lesson
        </p>
        <h1 className="h-display text-3xl sm:text-4xl">{data.title}</h1>
      </header>

      {data.blocks.map((b, i) => {
        if (b.kind === "practice")
          return <PracticeBlock key={b.questionId ?? i} block={b} />;
        if (b.kind === "code")
          return (
            <div key={i} className="flex flex-col gap-1">
              {b.caption && (
                <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.14em]">
                  {b.caption}
                </p>
              )}
              <pre className="bg-surface-1 border-border/60 overflow-x-auto rounded-xl border p-4 font-mono text-xs leading-relaxed">
                <code>{b.code}</code>
              </pre>
            </div>
          );
        const label = BLOCK_LABELS[b.kind];
        return (
          <section key={i} className="flex flex-col gap-2">
            {label && (
              <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
                {label}
              </p>
            )}
            <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:font-display prose-headings:not-italic">
              <Markdown>{b.markdown ?? ""}</Markdown>
            </div>
          </section>
        );
      })}

      <div className="border-border mt-4 flex items-center justify-between gap-3 border-t pt-6">
        {completed ? (
          <>
            <Badge variant="status" tone="mastered">
              <CheckCircle2 data-icon="inline-start" />
              Complete
            </Badge>
            <Button
              onClick={() => router.push(`/dashboard?id=${data.curriculumId}`)}
            >
              Back to path
            </Button>
          </>
        ) : (
          <>
            <span className="text-muted-foreground text-sm">
              Done reading and practicing?
            </span>
            <Button onClick={markComplete} disabled={completing}>
              {completing && <Spinner data-icon="inline-start" />}
              Mark complete
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
