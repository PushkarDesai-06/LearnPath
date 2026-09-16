"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
import { LoadingRing } from "@/components/ui/loading-ring";
import { Skeleton } from "@/components/ui/skeleton";
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
  /** Present on "generating" — lets the page link back to the right path. */
  curriculumId?: string;
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
            {busy && <LoadingRing data-icon="inline-start" />}
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

/**
 * Shown while the first GET is still in flight. At that point we don't know yet
 * whether the lesson is already stored — so mirror the article layout instead
 * of claiming it's being written.
 */
function LessonSkeleton() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Skeleton className="h-8 w-28" />
      <header className="flex flex-col gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-3/4" />
      </header>
      {Array.from({ length: 3 }).map((_, i) => (
        <section key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </section>
      ))}
      <div className="border-border mt-4 flex items-center justify-between gap-3 border-t pt-6">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}

/** Shown once the API has told us the lesson isn't written yet. */
function LessonGenerating({ curriculumId }: { curriculumId?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <LoadingRing className="size-7" />
      <div className="flex flex-col gap-1.5">
        <p className="text-foreground text-sm">Writing your lesson…</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          This one hasn&apos;t been generated yet. It keeps building in the
          background — stay here and it will appear on its own, or come back
          later.
        </p>
      </div>
      <Button variant="secondary" size="sm" asChild>
        <Link
          href={curriculumId ? `/dashboard?id=${curriculumId}` : "/dashboard"}
        >
          <ArrowLeft data-icon="inline-start" />
          Back to path
        </Link>
      </Button>
    </div>
  );
}

/**
 * "checking" — waiting on content we expect to exist (skeleton).
 * "generating" — no content yet, so show the come-back-later notice.
 */
type Phase = "checking" | "generating" | "ready" | "error";

function LessonPageInner() {
  const params = useParams<{ lessonId: string }>();
  const router = useRouter();
  // The dashboard already knows whether this lesson is written and says so in
  // `?ready=`. Trust it for the first paint so a not-yet-generated lesson never
  // flashes a skeleton while the API confirms what we were just told; the poll
  // below corrects the state either way.
  const readyHint = useSearchParams().get("ready");
  const [data, setData] = useState<Lesson | null>(null);
  const [phase, setPhase] = useState<Phase>(
    readyHint === "0" ? "generating" : "checking",
  );
  const [error, setError] = useState("");
  const [curriculumId, setCurriculumId] = useState<string>();
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
            setPhase("ready");
          } else if (Date.now() >= deadline) {
            setError("This is taking longer than expected.");
            setPhase("error");
          } else {
            // Not in the DB yet — swap the skeleton for the generating notice.
            setCurriculumId(res.curriculumId);
            setPhase("generating");
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
          setPhase("error");
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

  if (phase === "checking") return <LessonSkeleton />;
  if (phase === "generating")
    return <LessonGenerating curriculumId={curriculumId} />;
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
            setPhase("checking");
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
            <div className="prose prose-invert prose-sm max-w-none prose-p:my-2">
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
              {completing && <LoadingRing data-icon="inline-start" />}
              Mark complete
            </Button>
          </>
        )}
      </div>
    </article>
  );
}

export default function LessonPage() {
  // useSearchParams needs a Suspense boundary; the skeleton is the right
  // fallback since at that point we haven't read the hint yet.
  return (
    <Suspense fallback={<LessonSkeleton />}>
      <LessonPageInner />
    </Suspense>
  );
}
