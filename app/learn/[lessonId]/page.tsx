"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
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
      if (res?.correct) toast.success("Correct!");
      else toast.warning("Not quite — check the explanation.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not grade answer",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-3">
        <p className="text-primary text-xs font-semibold uppercase">Practice</p>
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
                className="flex cursor-pointer items-center gap-2 font-normal"
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
          <div className="flex flex-col gap-1 text-sm">
            <Badge
              variant={result.correct ? "default" : "destructive"}
              className="self-start"
            >
              {result.correct ? "Correct" : "Not quite"}
            </Badge>
            {result.feedback && <p>{result.feedback}</p>}
            {result.explanation && (
              <div className="text-muted-foreground">
                <span className="font-medium">Explanation:</span>
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
const POLL_TIMEOUT_MS = 3 * 60 * 1000; // give up the spinner after 3 min

export default function LessonPage() {
  const params = useParams<{ lessonId: string }>();
  const router = useRouter();
  const [data, setData] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0); // bump to retry
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [startedAt] = useState(() => Date.now());

  // Poll the lesson endpoint until it's generated (it's built in the background).
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
      toast.success("Lesson completed — your path was updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setCompleting(false);
    }
  }

  if (loading)
    return (
      <div className="flex flex-col items-center gap-2 py-16">
        <Spinner />
        <p className="text-muted-foreground text-sm">Generating your lesson…</p>
        <p className="text-muted-foreground text-xs">
          You can leave — it&apos;ll keep generating in the background.
        </p>
      </div>
    );
  if (error && !data)
    return (
      <div className="flex flex-col items-center gap-3 py-16">
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{data.title}</h1>
        <Button variant="link" size="sm" asChild>
          <Link href={`/dashboard?id=${data.curriculumId}`}>Path </Link>
        </Button>
      </div>

      {data.blocks.map((b, i) => {
        if (b.kind === "practice")
          return <PracticeBlock key={b.questionId ?? i} block={b} />;
        if (b.kind === "code")
          return (
            <Card key={i}>
              <CardContent className="flex flex-col gap-1">
                {b.caption && (
                  <p className="text-muted-foreground text-xs">{b.caption}</p>
                )}
                <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">
                  <code>{b.code}</code>
                </pre>
              </CardContent>
            </Card>
          );
        return (
          <Card key={i}>
            <CardContent className="flex flex-col gap-1">
              {b.kind !== "text" && (
                <p className="text-muted-foreground text-xs font-semibold uppercase">
                  {b.kind}
                </p>
              )}
              <Markdown>{b.markdown ?? ""}</Markdown>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardContent className="flex items-center justify-between gap-3">
          {completed ? (
            <>
              <Badge>
                <CheckCircle2 data-icon="inline-start" />
                Lesson completed
              </Badge>
              <Button
                onClick={() =>
                  router.push(`/dashboard?id=${data.curriculumId}`)
                }
              >
                Back to path
              </Button>
            </>
          ) : (
            <>
              <span className="text-muted-foreground text-sm">
                Finished reading and practicing?
              </span>
              <Button onClick={markComplete} disabled={completing}>
                {completing && <Spinner data-icon="inline-start" />}
                Mark complete
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
