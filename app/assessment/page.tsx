"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client/api";
import { Badge, Button, Card, ErrorText, Spinner } from "@/components/ui";

interface Question {
  id: string;
  prompt: string;
  choices: string[] | null;
  topic: string;
  level: number;
}
interface ReviewItem {
  id: string;
  prompt: string;
  choices: string[] | null;
  topic: string;
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
        if (err instanceof ApiClientError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to start");
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

  if (phase === "loading") return <Spinner label="Preparing your quiz…" />;

  // -------- result screen --------
  if (phase === "result" && result) {
    const correct = result.review.filter((r) => r.correct).length;
    const total = result.review.length;
    return (
      <div className="space-y-4">
        <Card className="space-y-3 text-center">
          <h1 className="text-2xl font-bold">Quiz complete</h1>
          <p className="text-4xl font-bold">
            {Math.round(result.score * 100)}%
          </p>
          <p className="text-sm text-gray-500">
            {correct}/{total} correct · estimated level{" "}
            <Badge tone="blue">{result.estimatedLevel}</Badge>
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={() => setShowAnswers((s) => !s)}>
              {showAnswers ? "Hide answers" : "Check answers"}
            </Button>
            {result.recommendAnotherRound && (
              <Button variant="secondary" onClick={refine}>
                Refine my level (1 more short quiz)
              </Button>
            )}
            <Button onClick={generatePath} disabled={generating}>
              {generating ? "Generating…" : "Generate my learning path →"}
            </Button>
          </div>
          <ErrorText>{error}</ErrorText>
        </Card>

        {showAnswers &&
          result.review.map((r, i) => (
            <Card key={r.id} className="space-y-2">
              <p className="text-sm font-medium">
                {i + 1}. {r.prompt}
              </p>
              <ul className="space-y-1">
                {(r.choices ?? []).map((c, idx) => {
                  const isCorrect = String(idx) === r.correctKey;
                  const isYours = String(idx) === r.yourAnswer;
                  return (
                    <li
                      key={idx}
                      className={`rounded px-2 py-1 text-sm ${
                        isCorrect
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : isYours
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : ""
                      }`}
                    >
                      {isCorrect ? "✓ " : isYours ? "✗ " : ""}
                      {c}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
      </div>
    );
  }

  // -------- quiz screen --------
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Knowledge quiz</h1>
        <p className="text-sm text-gray-500">
          Answer every question, then submit once — you&apos;ll get a score and
          can review the correct answers.
        </p>
      </div>
      {questions.map((q, i) => (
        <Card key={q.id} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{i + 1}.</span>
            <Badge tone="gray">level {q.level}</Badge>
          </div>
          <p className="whitespace-pre-wrap font-medium">{q.prompt}</p>
          <div className="space-y-2">
            {(q.choices ?? []).map((c, idx) => (
              <label
                key={idx}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <input
                  type="radio"
                  name={q.id}
                  value={String(idx)}
                  checked={answers[q.id] === String(idx)}
                  onChange={() =>
                    setAnswers((a) => ({ ...a, [q.id]: String(idx) }))
                  }
                />
                {c}
              </label>
            ))}
          </div>
        </Card>
      ))}
      <ErrorText>{error}</ErrorText>
      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={busy || !allAnswered}>
          {busy ? "Submitting…" : "Submit quiz"}
        </Button>
        {!allAnswered && (
          <span className="text-sm text-gray-400">
            Answer all {questions.length} questions to submit.
          </span>
        )}
      </div>
    </div>
  );
}
