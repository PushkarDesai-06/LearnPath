"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, X } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  prompt: string;
  choices: string[] | null;
  level: number;
}
interface ReviewItem {
  id: string;
  prompt: string;
  choices: string[] | null;
  yourAnswer: string | null;
  correctKey: string | null;
  correct: boolean | null;
}
interface ResultData {
  score: number;
  estimatedLevel: string;
  review: ReviewItem[];
  recommendAnotherRound: boolean;
  nextQuestions: Question[];
}
type Phase = "loading" | "quiz" | "result";

// Sentinel answer for "I don't know" — never matches a choice, so it grades as
// incorrect (which is the honest signal: the learner doesn't know it).
const IDK = "__idk__";

export default function AssessmentPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [assessmentId, setAssessmentId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ResultData | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
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
        else
          toast.error(err instanceof Error ? err.message : "Failed to start");
      });
    return () => {
      active = false;
    };
  }, [router]);

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
        `Scored ${Math.round(res.score * 100)}% — level ${res.estimatedLevel}`,
      );
      if (res.recommendAnotherRound) {
        toast.info(
          "Your results look mixed — try one more short quiz to refine.",
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
    setPhase("quiz");
  }

  async function generatePath() {
    setGenerating(true);
    const t = toast.loading("Generating your learning path…");
    try {
      const res = await api<{ curriculum: { id: string } }>(
        "/api/curriculum/generate",
        { method: "POST" },
      );
      toast.success("Your learning path is ready!", { id: t });
      router.push(`/dashboard?id=${res.curriculum.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed", {
        id: t,
      });
      setGenerating(false);
    }
  }

  if (phase === "loading")
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );

  if (phase === "result" && result) {
    const correct = result.review.filter((r) => r.correct).length;
    const total = result.review.length;
    return (
      <div className="flex flex-col gap-4">
        <Card className="text-center">
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Quiz complete
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <p className="text-5xl font-bold">
              {Math.round(result.score * 100)}%
            </p>
            <p className="text-muted-foreground text-sm">
              {correct}/{total} correct · estimated level{" "}
              <Badge variant="secondary">{result.estimatedLevel}</Badge>
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAnswers((s) => !s)}
              >
                {showAnswers ? "Hide answers" : "Check answers"}
              </Button>
              {result.recommendAnotherRound && (
                <Button variant="outline" onClick={refine}>
                  Refine my level
                </Button>
              )}
              <Button onClick={generatePath} disabled={generating}>
                {generating && <Spinner data-icon="inline-start" />}
                Generate my path
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {showAnswers &&
          result.review.map((r, i) => (
            <Card key={r.id}>
              <CardContent className="flex flex-col gap-2">
                <p className="text-sm font-medium">
                  {i + 1}. {r.prompt}
                </p>
                <div className="flex flex-col gap-1">
                  {(r.choices ?? []).map((c, idx) => {
                    const isCorrect = String(idx) === r.correctKey;
                    const isYoursWrong =
                      String(idx) === r.yourAnswer && !isCorrect;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1 text-sm",
                          isCorrect &&
                            "bg-primary/10 text-foreground font-medium",
                          isYoursWrong && "text-destructive",
                        )}
                      >
                        {isCorrect ? (
                          <Check className="text-primary size-4 shrink-0" />
                        ) : isYoursWrong ? (
                          <X className="size-4 shrink-0" />
                        ) : (
                          <span className="size-4 shrink-0" />
                        )}
                        {c}
                      </div>
                    );
                  })}
                </div>
                {r.yourAnswer === IDK && (
                  <p className="text-muted-foreground text-xs">
                    You answered: I don&apos;t know
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Knowledge quiz</h1>
        <p className="text-muted-foreground text-sm">
          Answer every question, then submit once. I will review the answers and
          decide the curriculum :)
        </p>
      </div>
      {questions.map((q, i) => (
        <Card key={q.id}>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{i + 1}.</span>
              <Badge variant="outline">level {q.level}</Badge>
            </div>
            <p className="font-medium whitespace-pre-wrap">{q.prompt}</p>
            <RadioGroup
              value={answers[q.id] ?? ""}
              onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
            >
              {(q.choices ?? []).map((c, idx) => (
                <Label
                  key={idx}
                  htmlFor={`${q.id}-${idx}`}
                  className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md border p-3 font-normal"
                >
                  <RadioGroupItem value={String(idx)} id={`${q.id}-${idx}`} />
                  {c}
                </Label>
              ))}
            </RadioGroup>
            <Button
              type="button"
              variant={answers[q.id] === IDK ? "secondary" : "ghost"}
              size="sm"
              className="self-start"
              onClick={() => setAnswers((a) => ({ ...a, [q.id]: IDK }))}
            >
              I don&apos;t know
            </Button>
          </CardContent>
        </Card>
      ))}
      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={busy || !allAnswered}>
          {busy && <Spinner data-icon="inline-start" />}
          Submit quiz
        </Button>
        {!allAnswered && (
          <span className="text-muted-foreground text-sm">
            Answer all {questions.length} questions.
          </span>
        )}
      </div>
    </div>
  );
}
