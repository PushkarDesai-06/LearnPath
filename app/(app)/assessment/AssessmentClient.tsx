"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, X } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LoadingRing, PageLoader } from "@/components/ui/loading-ring";
import { cn } from "@/lib/utils";
import { InlineMarkdown } from "@/components/Markdown";
import { PageHeader } from "@/components/PageHeader";
import { SetupSteps } from "@/components/SetupSteps";
import { StatRow } from "@/components/StatRow";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AssessmentState, PublicQuestion, ReviewItem } from "@/lib/data/types";
import { generatePathAction } from "./actions";

type Question = Pick<PublicQuestion, "id" | "prompt" | "choices" | "level">;

interface ResultData {
  score: number;
  estimatedLevel: string;
  review: ReviewItem[];
  recommendAnotherRound: boolean;
  nextQuestions: Question[];
}
type Phase = "loading" | "quiz" | "result" | "error";

// Sentinel answer for "I don't know" — never matches a choice, so it grades as
// incorrect (which is the honest signal: the learner doesn't know it).
const IDK = "__idk__";

function resultFrom(s: Extract<AssessmentState, { kind: "complete" }>): ResultData {
  return {
    score: s.score,
    estimatedLevel: s.estimatedLevel,
    review: s.review,
    recommendAnotherRound: false,
    nextQuestions: [],
  };
}

/**
 * The quiz. A resumed or finished assessment arrives server-rendered via
 * `initial`; only a FRESH quiz is generated from here (a POST that runs the
 * LLM for several seconds and writes the assessment — never done during a
 * page render).
 */
export function AssessmentClient({
  initial,
  onboardingId,
}: {
  initial: Exclude<AssessmentState, { kind: "no_onboarding" }>;
  onboardingId: string | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(
    initial.kind === "complete"
      ? "result"
      : initial.kind === "in_progress"
        ? "quiz"
        : "loading",
  );
  const [assessmentId, setAssessmentId] = useState(
    initial.kind === "fresh" ? "" : initial.assessmentId,
  );
  const [questions, setQuestions] = useState<Question[]>(
    initial.kind === "in_progress" ? initial.questions : [],
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ResultData | null>(
    initial.kind === "complete" ? resultFrom(initial) : null,
  );
  const [showAnswers, setShowAnswers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [startError, setStartError] = useState("");
  const [startAttempt, setStartAttempt] = useState(0);

  const needsQuiz = initial.kind === "fresh";
  useEffect(() => {
    if (!needsQuiz) return;
    let active = true;
    api<{
      assessmentId: string;
      complete: boolean;
      questions?: Question[];
      score?: number;
      result?: { estimatedLevel: string };
      review?: ReviewItem[];
    }>("/api/assessment/start", { body: { onboardingId: onboardingId ?? undefined } })
      .then((res) => {
        if (!active) return;
        setAssessmentId(res.assessmentId);
        if (res.complete) {
          setResult({
            score: res.score ?? 0,
            estimatedLevel: res.result?.estimatedLevel ?? "",
            review: res.review ?? [],
            recommendAnotherRound: false,
            nextQuestions: [],
          });
          setPhase("result");
        } else {
          setQuestions(res.questions ?? []);
          setPhase("quiz");
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiClientError && err.status === 401)
          router.push("/login");
        else {
          setStartError(err instanceof Error ? err.message : "Could not prepare your quiz.");
          setPhase("error");
        }
      });
    return () => {
      active = false;
    };
  }, [needsQuiz, onboardingId, router, startAttempt]);

  const allAnswered =
    questions.length > 0 && questions.every((q) => answers[q.id] !== undefined);

  async function submit() {
    setBusy(true);
    try {
      const payload = questions.map((q) => ({
        questionId: q.id,
        answer: answers[q.id],
      }));
      const res = await api<ResultData>("/api/assessment/submit", {
        body: { assessmentId, answers: payload },
      });
      setResult(res);
      setShowAnswers(false);
      setPhase("result");
      window.scrollTo({ top: 0 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  function refine() {
    if (!result) return;
    setQuestions(result.nextQuestions);
    setAnswers({});
    setPhase("quiz");
  }

  async function generatePath() {
    setGenerating(true);
    // On success the action redirects to the new dashboard (and refreshes the
    // topbar's topic list); it only returns when something went wrong.
    let error: string;
    try {
      const res = await generatePathAction(assessmentId);
      if (!res?.error) return;
      error = res.error;
    } catch (err) {
      // The redirect is a navigation, not a failure: leave the busy state up.
      const digest = (err as { digest?: unknown } | null)?.digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) return;
      error = "Couldn't reach the server. Check your connection and try again.";
    }
    toast.error(error);
    setGenerating(false);
  }

  if (phase === "loading")
    return (
      <Shell step={1}>
        <PageLoader label="Writing your quiz…" />
      </Shell>
    );

  if (phase === "error") {
    return (
      <Shell step={1}>
        <Alert variant="destructive">
          <AlertDescription>{startError}</AlertDescription>
        </Alert>
        <Button
          className="self-start"
          onClick={() => {
            setStartError("");
            setPhase("loading");
            setStartAttempt((attempt) => attempt + 1);
          }}
        >
          Try again
        </Button>
      </Shell>
    );
  }

  if (phase === "result" && result) {
    const correct = result.review.filter((r) => r.correct).length;
    const total = result.review.length;
    return (
      <Shell step={generating ? 2 : 1}>
        <PageHeader eyebrow="Knowledge check" title="Here's where you are" />
        <StatRow
          stats={[
            { label: "Score", value: `${Math.round(result.score * 100)}%` },
            { label: "Correct", value: `${correct}/${total}` },
            { label: "Level", value: result.estimatedLevel },
          ]}
        />
        {generating ? (
          <Card role="status">
            <CardContent className="flex items-start gap-3">
              <LoadingRing className="mt-0.5 size-5 shrink-0" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">Building your path…</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Writing modules and lessons for a {result.estimatedLevel} learner, ordering them
                  so nothing comes before what it depends on, and marking what you already showed
                  you know. This usually takes under a minute.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {result.recommendAnotherRound && (
              <p className="text-muted-foreground text-sm">
                Your answers were mixed (some harder ones right, easier ones wrong). A few more
                questions would pin your level down.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={generatePath}>
                Build my path
                <ArrowRight data-icon="inline-end" />
              </Button>
              {result.recommendAnotherRound && (
                <Button variant="secondary" onClick={refine}>
                  Answer a few more
                </Button>
              )}
              <Button
                variant="ghost"
                aria-expanded={showAnswers}
                onClick={() => setShowAnswers((s) => !s)}
              >
                {showAnswers ? "Hide answers" : "Review answers"}
              </Button>
            </div>
          </div>
        )}

        {showAnswers && (
          <ol className="flex flex-col gap-3">
            {result.review.map((r, i) => (
              <li key={r.id}>
                <Card>
                  <CardContent className="flex flex-col gap-2">
                    <p className="text-sm font-medium">
                      {i + 1}. <InlineMarkdown>{r.prompt}</InlineMarkdown>
                    </p>
                    <ul className="flex flex-col gap-1">
                      {(r.choices ?? []).map((c, idx) => {
                        const isCorrect = String(idx) === r.correctKey;
                        const isYoursWrong = String(idx) === r.yourAnswer && !isCorrect;
                        return (
                          <li
                            key={idx}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1 text-sm",
                              isCorrect && "bg-primary/10 text-foreground font-medium",
                              isYoursWrong && "text-destructive",
                            )}
                          >
                            {isCorrect ? (
                              <Check className="text-primary size-4 shrink-0" aria-label="Correct answer" />
                            ) : isYoursWrong ? (
                              <X className="size-4 shrink-0" aria-label="Your answer" />
                            ) : (
                              <span className="size-4 shrink-0" />
                            )}
                            <span className="min-w-0 [overflow-wrap:anywhere]">
                              <InlineMarkdown>{c}</InlineMarkdown>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {r.yourAnswer === IDK && (
                      <p className="text-muted-foreground text-xs">You answered: I don&apos;t know</p>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </Shell>
    );
  }

  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;

  return (
    <Shell step={1}>
      <PageHeader
        eyebrow="Knowledge check"
        title="Where are you starting from?"
        description={`${questions.length} multiple-choice questions, easy to hard. Pick "I don't know" rather than guessing: an honest answer gives you a better path.`}
      />
      <ol className="flex flex-col gap-4">
        {questions.map((q, i) => {
          const promptId = `${q.id}-prompt`;
          return (
            <li key={q.id}>
              <Card>
                <CardContent className="flex flex-col gap-3">
                  <p id={promptId} className="font-medium whitespace-pre-wrap">
                    <span className="text-muted-foreground mr-2 font-mono text-xs tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <InlineMarkdown>{q.prompt}</InlineMarkdown>
                  </p>
                  <RadioGroup
                    aria-labelledby={promptId}
                    value={answers[q.id] ?? ""}
                    onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                  >
                    {[...(q.choices ?? []).map((c, idx) => ({ value: String(idx), label: c })), { value: IDK, label: null }].map(
                      (opt) => (
                        <Label
                          key={opt.value}
                          htmlFor={`${q.id}-${opt.value}`}
                          className={cn(
                            "hover:bg-muted/50 has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-muted/40 flex cursor-pointer items-center gap-2 rounded-md border p-3 font-normal",
                            opt.label === null && "text-muted-foreground border-dashed",
                          )}
                        >
                          <RadioGroupItem value={opt.value} id={`${q.id}-${opt.value}`} />
                          <span className="min-w-0 [overflow-wrap:anywhere]">
                            {opt.label === null ? "I don't know" : <InlineMarkdown>{opt.label}</InlineMarkdown>}
                          </span>
                        </Label>
                      ),
                    )}
                  </RadioGroup>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
      {/* Sticky, so the count and the one submit are always in reach. */}
      <div className="bg-background/85 border-border sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <span className="text-muted-foreground font-mono text-xs tabular-nums" aria-live="polite">
          {answeredCount} / {questions.length} answered
        </span>
        <Button onClick={submit} disabled={busy || !allAnswered}>
          {busy && <LoadingRing data-icon="inline-start" className="text-current" />}
          Submit answers
        </Button>
      </div>
    </Shell>
  );
}

/** Same reading column and step marker in every phase. */
function Shell({ step, children }: { step: 0 | 1 | 2; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-4">
      <SetupSteps current={step} />
      {children}
    </div>
  );
}
