"use client";

import { useState } from "react";
import { Check, X, RotateCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/Markdown";
import { gradeMcq } from "@/lib/domain/grade";
import { cn } from "@/lib/utils";
import type { LessonBlockDTO } from "@/lib/data/types";

interface PracticeResult {
  correct: boolean;
  feedback: string | null;
  explanation: string | null;
}

/** A graded attempt, plus whether it was the one that counted. */
type Attempt = PracticeResult & { counted: boolean };

/** The three-dot "working on it" indicator used during agent grading. */
function GradingIndicator() {
  return (
    <div
      role="status"
      aria-label="Grading your answer"
      className="animate-in fade-in-0 slide-in-from-bottom-1 text-muted-foreground flex items-center gap-1.5 text-xs duration-300 ease-out"
    >
      <span className="bg-muted-foreground/70 size-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
      <span className="bg-muted-foreground/70 size-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
      <span className="bg-muted-foreground/70 size-1.5 animate-bounce rounded-full" />
      <span className="ml-1.5">Grading your answer…</span>
    </div>
  );
}

/**
 * One inline practice question.
 *
 * MCQs are graded here in the browser — the key shipped with the lesson — so
 * the verdict and explanation appear the instant a choice is submitted. The
 * POST still goes out, in the background, because the server's re-grade is what
 * actually moves mastery; only its failure is surfaced (with a retry).
 *
 * Short answers have no local key: they go to the grading agent and wait, which
 * takes seconds on this provider, so the card animates while it thinks.
 *
 * Reset clears the answer and lets the learner take the question again. Replays
 * are still graded — an MCQ locally, a short answer by the agent — but they do
 * NOT move mastery: the answer has been on screen since the first attempt, so
 * only that first one is honest signal.
 */
export function PracticeBlock({
  block,
  lessonId,
}: {
  block: LessonBlockDTO;
  lessonId: string;
}) {
  const isMcq = block.type === "mcq" && !!block.choices;
  const [answer, setAnswer] = useState("");
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<Attempt | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /** Set once the mastery-moving attempt has been made; reset does not clear it. */
  const [spent, setSpent] = useState(false);

  /** Send the attempt to the server: the authoritative re-grade + mastery update. */
  const record = (value: string, counts: boolean) =>
    api<PracticeResult>(`/api/lesson/${lessonId}/practice`, {
      body: {
        questionId: block.questionId,
        answer: value,
        countsTowardMastery: counts,
      },
    });

  function announce(correct: boolean) {
    if (correct) toast.success("Correct.");
    else toast.warning("Not quite. Read the explanation.");
  }

  async function submit() {
    const value = answer.trim();
    if (!value || grading || result) return;

    const counted = !spent;

    if (isMcq) {
      // Same grader the route uses, so the local verdict and the one being
      // written server-side can't disagree.
      const correct = gradeMcq(
        value,
        block.correctKey ?? undefined,
        block.choices ?? undefined,
      );
      setResult({
        correct,
        feedback: null,
        explanation: block.explanation ?? null,
        counted,
      });
      announce(correct);
      // A replay needs no round trip at all — nothing to record, and the key is
      // already here.
      if (counted) {
        setSpent(true);
        setSaveFailed(false);
        record(value, true).catch(() => setSaveFailed(true));
      }
      return;
    }

    setGrading(true);
    try {
      const res = await record(value, counted);
      setResult({ ...res, counted });
      if (counted) setSpent(true);
      announce(res.correct);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not grade answer",
      );
    } finally {
      setGrading(false);
    }
  }

  function retrySave() {
    setSaveFailed(false);
    record(answer.trim(), true).catch(() => setSaveFailed(true));
  }

  /** Clear the attempt and take the question again. `spent` deliberately survives. */
  function reset() {
    setAnswer("");
    setResult(null);
    setSaveFailed(false);
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
      {/* Light travelling across the card while the agent grades. */}
      {grading && (
        <div
          aria-hidden
          className="animate-sweep via-primary/10 pointer-events-none absolute inset-0 bg-linear-to-r from-transparent to-transparent"
        />
      )}
      <CardContent className="flex flex-col gap-3">
        <p className="text-primary font-mono text-[10px] uppercase tracking-[0.18em]">
          Practice
        </p>
        <p className="font-medium">{block.prompt}</p>
        {isMcq ? (
          <RadioGroup
            value={answer}
            onValueChange={setAnswer}
            disabled={!!result}
          >
            {block.choices!.map((c, i) => {
              const key = String(i);
              // Only meaningful once graded — before that every choice is neutral.
              const isKey = key === (block.correctKey ?? "").trim();
              const isCorrect = !!result && isKey;
              const isYoursWrong = !!result && key === answer && !isKey;
              return (
                <Label
                  key={i}
                  htmlFor={`${block.questionId}-${i}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 font-normal transition-colors",
                    !result && "hover:bg-surface-2/50",
                    isCorrect && "bg-primary/10 text-foreground font-medium",
                    isYoursWrong && "text-destructive",
                  )}
                >
                  <RadioGroupItem
                    value={key}
                    id={`${block.questionId}-${i}`}
                  />
                  {c}
                  {isCorrect && (
                    <Check className="text-primary animate-in zoom-in-50 ml-auto size-4 shrink-0 duration-300 ease-out" />
                  )}
                  {isYoursWrong && (
                    <X className="animate-in zoom-in-50 ml-auto size-4 shrink-0 duration-300 ease-out" />
                  )}
                </Label>
              );
            })}
          </RadioGroup>
        ) : (
          <Textarea
            rows={2}
            value={answer}
            disabled={!!result || grading}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your answer…"
          />
        )}
        {!result ? (
          grading ? (
            <GradingIndicator />
          ) : (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={submit} disabled={!answer.trim()}>
                Check answer
              </Button>
              {/* A radio can't be unpicked, so clearing needs its own control. */}
              {answer.trim() && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={reset}
                  className="text-muted-foreground animate-in fade-in-0 duration-200"
                >
                  <RotateCcw data-icon="inline-start" />
                  Reset
                </Button>
              )}
            </div>
          )
        ) : (
          <div className="animate-in fade-in-0 slide-in-from-bottom-2 flex flex-col gap-2 text-sm duration-300 ease-out">
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
            {saveFailed && (
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                Couldn&apos;t save this to your progress.
                <button
                  type="button"
                  onClick={retrySave}
                  className="text-foreground inline-flex items-center gap-1 underline underline-offset-2"
                >
                  <RotateCw className="size-3" />
                  Retry
                </button>
              </p>
            )}
            <div className="mt-1 flex items-center gap-3">
              <Button size="sm" variant="secondary" onClick={reset}>
                <RotateCcw data-icon="inline-start" />
                Try again
              </Button>
              {!result.counted && (
                <span className="text-muted-foreground text-xs">
                  Practice only — your first attempt is the one that counted.
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
