"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client/api";
import { Badge, Button, Card, ErrorText, Spinner } from "@/components/ui";

interface Question {
  id: string;
  prompt: string;
  type: "mcq" | "short";
  choices: string[] | null;
  level: number;
}
interface StartResp {
  assessmentId: string;
  question: Question;
  answered: number;
  cap: number;
}
interface AnswerResp {
  done: boolean;
  correct: boolean;
  feedback: string | null;
  question?: Question;
  answered?: number;
  cap?: number;
  result?: {
    estimatedLevel: string;
    strengths: string[];
    gaps: string[];
    perTopicMastery: { topic: string; score: number }[];
  };
}

export default function AssessmentPage() {
  const router = useRouter();
  const [assessmentId, setAssessmentId] = useState("");
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [progress, setProgress] = useState({ answered: 0, cap: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnswerResp["result"] | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let active = true;
    api<StartResp>("/api/assessment/start", { method: "POST" })
      .then((res) => {
        if (!active) return;
        setAssessmentId(res.assessmentId);
        setQuestion(res.question);
        setProgress({ answered: res.answered, cap: res.cap });
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiClientError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to start");
      })
      .finally(() => {
        if (active) setStarting(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || !question) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<AnswerResp>("/api/assessment/answer", {
        body: { assessmentId, questionId: question.id, answer },
      });
      setAnswer("");
      if (res.done) {
        setResult(res.result ?? null);
        setQuestion(null);
      } else if (res.question) {
        setQuestion(res.question);
        setProgress({
          answered: res.answered ?? progress.answered + 1,
          cap: res.cap ?? progress.cap,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (starting) return <Spinner label="Preparing your assessment…" />;

  if (result) {
    return (
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold">Assessment complete</h1>
        <p>
          Estimated level:{" "}
          <Badge tone="blue">{result.estimatedLevel}</Badge>
        </p>
        {result.strengths.length > 0 && (
          <p className="text-sm">
            <strong>Strengths:</strong> {result.strengths.join(", ")}
          </p>
        )}
        {result.gaps.length > 0 && (
          <p className="text-sm">
            <strong>Gaps:</strong> {result.gaps.join(", ")}
          </p>
        )}
        <Button onClick={() => router.push("/curriculum")}>
          Generate my learning path →
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Knowledge assessment</h1>
        <span className="text-sm text-gray-500">
          {progress.answered}/{progress.cap} answered
        </span>
      </div>
      {question && (
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge>level {question.level}</Badge>
            <Badge tone="gray">{question.type}</Badge>
          </div>
          <p className="whitespace-pre-wrap font-medium">{question.prompt}</p>
          <form onSubmit={submit} className="space-y-3">
            {question.type === "mcq" && question.choices ? (
              <div className="space-y-2">
                {question.choices.map((c, i) => (
                  <label
                    key={i}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    <input
                      type="radio"
                      name="choice"
                      value={String(i)}
                      checked={answer === String(i)}
                      onChange={(e) => setAnswer(e.target.value)}
                    />
                    {c}
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                rows={3}
                placeholder="Your answer…"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
            )}
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={busy || !answer.trim()}>
              {busy ? "Checking…" : "Submit answer"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
