"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  const [error, setError] = useState("");

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
        else setError(err instanceof Error ? err.message : "Failed to start");
      });
    return () => {
      active = false;
    };
  }, [router]);

  const allAnswered =
    questions.length > 0 && questions.every((q) => answers[q.id] !== undefined);

  async function submit() {
    setBusy(true);
    setError("");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
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
    setError("");
    try {
      const res = await api<{ curriculum: { id: string } }>(
        "/api/curriculum/generate",
        { method: "POST" },
      );
      router.push(`/curriculum?id=${res.curriculum.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
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
            <CardTitle className="text-base font-medium">Quiz complete</CardTitle>
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
              <Button variant="outline" onClick={() => setShowAnswers((s) => !s)}>
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
            {error && (
              <Alert variant="destructive" className="text-left">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
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
                          isCorrect && "bg-primary/10 text-foreground font-medium",
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
          Answer every question, then submit once — you&apos;ll get a score and
          can review the correct answers.
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
          </CardContent>
        </Card>
      ))}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
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
