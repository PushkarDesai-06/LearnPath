"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CalmState } from "./CalmState";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AssessmentState, PublicQuestion, ReviewItem } from "@/lib/data/types";

type Question = Pick<PublicQuestion, "id" | "prompt" | "choices" | "level">;

interface ResultData {
  score: number;
  estimatedLevel: string;
  review: ReviewItem[];
  recommendAnotherRound: boolean;
  nextQuestions: Question[];
}
type Phase = "loading" | "quiz" | "result" | "error";

// Sentinel answer for "I don't know", never matches a choice, so it grades as
// incorrect (which is the honest signal: the learner doesn't know it).
const IDK = "__idk__";

const GENERATION_STEPS = [
  "Reading your quiz results",
  "Choosing the modules",
  "Ordering the lessons",
  "Putting the path together",
] as const;

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
 * LLM for several seconds and writes the assessment, never done during a
 * page render).
 */
export function AssessmentClient({
  initial,
}: {
  initial: Exclude<AssessmentState, { kind: "no_onboarding" }>;
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
  const [current, setCurrent] = useState(0);
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
    }>("/api/assessment/start", { method: "POST" })
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
  }, [needsQuiz, router, startAttempt]);

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
      toast.success(
        `Scored ${Math.round(res.score * 100)}%, level ${res.estimatedLevel}`,
      );
      if (res.recommendAnotherRound) {
        toast.info(
          "Your results look mixed. Try one more short quiz to refine.",
        );
      }
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
    setCurrent(0);
    setPhase("quiz");
  }

  async function generatePath() {
    setGenerating(true);
    const t = toast.loading("Generating your learning path…");
    try {
      const res = await api<{ curriculum: { id: string } }>(
        "/api/curriculum/generate",
        { body: { assessmentId } },
      );
      toast.success("Your learning path is ready!", { id: t });
      // One transition: refresh so the Nav's topic list picks up the new
      // curriculum, then land on its dashboard.
      startTransition(() => {
        router.refresh();
        router.push(`/dashboard?id=${res.curriculum.id}`);
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed", {
        id: t,
      });
      setGenerating(false);
    }
  }

  if (phase === "loading")
    return (
      <CalmState
        title="Preparing your quiz"
        hint="This takes a few seconds."
      />
    );

  if (generating)
    return (
      <CalmState
        title="Building your path"
        steps={GENERATION_STEPS}
        hint="This can take a moment. You can leave and come back."
      />
    );

  if (phase === "error") {
    return (
      <div className="flex flex-col items-start gap-4">
        <Alert variant="destructive">
          <AlertDescription>{startError}</AlertDescription>
        </Alert>
        <Button onClick={() => {
          setStartError("");
          setPhase("loading");
          setStartAttempt((attempt) => attempt + 1);
        }}>
          Retry preparing quiz
        </Button>
      </div>
    );
  }

  if (phase === "result" && result) {
    const correct = result.review.filter((r) => r.correct).length;
    const total = result.review.length;
    return (
      <div className="flex flex-col gap-6">
        <section className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-1 px-6 py-8 text-center animate-in fade-in-0 zoom-in-95 duration-(--dur-slow) ease-(--ease-out)">
          <p className="text-[12px] font-medium text-faint">Quiz complete</p>
          <p className="font-mono text-5xl tabular-nums">
            {Math.round(result.score * 100)}%
          </p>
          <p className="text-[13px] text-muted-foreground">
            {correct}/{total} correct, estimated level{" "}
            <span className="rounded border border-border-strong px-1.5 py-0.5 font-mono text-[12px] text-foreground">
              {result.estimatedLevel}
            </span>
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAnswers((v) => !v)}
              aria-expanded={showAnswers}
            >
              {showAnswers ? "Hide answers" : "Check answers"}
            </Button>
            {result.recommendAnotherRound && (
              <Button variant="outline" onClick={refine}>
                Refine my level
              </Button>
            )}
            <Button onClick={generatePath} className="group">
              Generate my path
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </section>

        {showAnswers && (
          <ol className="flex flex-col gap-3 animate-in fade-in-0 duration-(--dur-base)">
            {result.review.map((r, i) => (
              <li
                key={r.id}
                className="flex flex-col gap-2 rounded-xl border border-border p-4"
              >
                <p className="flex items-start gap-2 text-[13.5px] font-medium">
                  <span className="mt-0.5 shrink-0" aria-label={r.correct ? "Correct" : "Incorrect"}>
                    {r.correct ? (
                      <Check className="size-4" aria-hidden />
                    ) : (
                      <X className="size-4 text-muted-foreground" aria-hidden />
                    )}
                  </span>
                  <span>
                    {i + 1}. {r.prompt}
                  </span>
                </p>
                <ul className="flex flex-col gap-0.5 pl-6">
                  {(r.choices ?? []).map((c, idx) => {
                    const isCorrect = String(idx) === r.correctKey;
                    const isYoursWrong =
                      String(idx) === r.yourAnswer && !isCorrect;
                    return (
                      <li
                        key={idx}
                        className={cn(
                          "flex min-h-7 items-center gap-2 text-[13px] text-muted-foreground",
                          isCorrect && "font-semibold text-foreground",
                          isYoursWrong && "line-through",
                        )}
                      >
                        <span className="flex size-4 shrink-0 items-center justify-center">
                          {isCorrect ? (
                            <Check className="size-3.5" aria-label="Correct answer" />
                          ) : isYoursWrong ? (
                            <X className="size-3.5" aria-label="Your answer" />
                          ) : null}
                        </span>
                        {c}
                      </li>
                    );
                  })}
                </ul>
                {r.yourAnswer === IDK && (
                  <p className="pl-6 text-[12px] text-faint">
                    You answered: I don&apos;t know
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  const question = questions[current];
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;
  const isLast = current === questions.length - 1;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Knowledge check</h1>
          <span className="font-mono text-[12px] tabular-nums text-faint">
            {current + 1}/{questions.length}
          </span>
        </div>
        <Progress
          value={(answeredCount / Math.max(questions.length, 1)) * 100}
          aria-label="Answered questions"
        />
      </header>

      {question && (
        <section
          key={question.id}
          aria-labelledby="question-prompt"
          className="flex flex-col gap-4 animate-in fade-in-0 slide-in-from-right-2 duration-(--dur-base) ease-(--ease-out)"
        >
          <div className="flex flex-col gap-1.5">
            <p className="text-[12px] text-faint">Level {question.level}</p>
            <p id="question-prompt" className="text-[15px] font-medium whitespace-pre-wrap">
              {question.prompt}
            </p>
          </div>
          <RadioGroup
            aria-labelledby="question-prompt"
            value={answers[question.id] ?? ""}
            onValueChange={(v) => setAnswers((a) => ({ ...a, [question.id]: v }))}
            className="gap-1"
          >
            {(question.choices ?? []).map((c, idx) => (
              <ChoiceRow
                key={idx}
                id={`${question.id}-${idx}`}
                value={String(idx)}
                selected={answers[question.id] === String(idx)}
              >
                {c}
              </ChoiceRow>
            ))}
            <ChoiceRow
              id={`${question.id}-idk`}
              value={IDK}
              selected={answers[question.id] === IDK}
              muted
            >
              I don&apos;t know
            </ChoiceRow>
          </RadioGroup>
        </section>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => setCurrent((n) => Math.max(0, n - 1))}
          disabled={current === 0}
        >
          <ArrowLeft data-icon="inline-start" />
          Back
        </Button>
        {isLast ? (
          <div className="flex items-center gap-3">
            {!allAnswered && (
              <span className="text-[12px] text-muted-foreground">
                Answer all {questions.length} questions.
              </span>
            )}
            <Button onClick={submit} loading={busy} disabled={!allAnswered}>
              Submit quiz
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={() => setCurrent((n) => Math.min(questions.length - 1, n + 1))}
            disabled={!question || answers[question.id] === undefined}
          >
            Next
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
      </div>
    </div>
  );
}

function ChoiceRow({
  id,
  value,
  selected,
  muted,
  children,
}: {
  id: string;
  value: string;
  selected: boolean;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Label
      htmlFor={id}
      className={cn(
        "flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-1.5 text-[13.5px] font-normal transition-colors duration-(--dur-fast) hover:bg-hover has-focus-visible:outline-2 has-focus-visible:outline-foreground",
        selected && "border-border-strong bg-surface-2",
        muted && !selected && "text-muted-foreground",
      )}
    >
      <RadioGroupItem value={value} id={id} />
      {children}
    </Label>
  );
}
