"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client/api";
import { Button, Card, ErrorText, Spinner } from "@/components/ui";

interface ClarityResponse {
  clearEnough: boolean;
  done: boolean;
  capReached: boolean;
  cycle: number;
  maxCycles: number;
  followupQuestion: string | null;
  refinedTopic: string | null;
  reason: string;
}

type Turn = { role: "user" | "assistant"; text: string };

export default function OnboardingPage() {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<ClarityResponse | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const description = input.trim();
    setTurns((t) => [...t, { role: "user", text: description }]);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const res = await api<ClarityResponse>("/api/onboarding/clarity", {
        body: { description },
      });
      if (res.done) {
        setDone(res);
        setTurns((t) => [
          ...t,
          {
            role: "assistant",
            text: `Great — we'll focus on: ${res.refinedTopic}`,
          },
        ]);
      } else {
        setTurns((t) => [
          ...t,
          { role: "assistant", text: res.followupQuestion ?? "Tell me more." },
        ]);
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        router.push("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">What do you want to learn?</h1>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Describe it in detail. I&apos;ll ask follow-up questions until it&apos;s
        clear enough to build a curriculum.
      </p>

      <div className="space-y-3">
        {turns.map((t, i) => (
          <Card
            key={i}
            className={
              t.role === "user"
                ? "bg-blue-50 dark:bg-blue-950"
                : "bg-white dark:bg-gray-900"
            }
          >
            <p className="text-xs font-semibold uppercase text-gray-400">
              {t.role === "user" ? "You" : "LearnPath"}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{t.text}</p>
          </Card>
        ))}
        {busy && <Spinner label="Thinking…" />}
      </div>

      {done ? (
        <Card className="space-y-3 border-green-300">
          <p className="text-sm">
            Topic locked in. {done.capReached && !done.clearEnough
              ? "(Proceeding with your description as-is.)"
              : ""}
          </p>
          <Button onClick={() => router.push("/assessment")}>
            Start knowledge assessment →
          </Button>
        </Card>
      ) : (
        <form onSubmit={send} className="space-y-2">
          <textarea
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            rows={3}
            placeholder="e.g. I want to learn React hooks to build a side project…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={busy}>
            Send
          </Button>
        </form>
      )}
    </div>
  );
}
