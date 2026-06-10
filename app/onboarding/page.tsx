"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

interface ClarityResponse {
  clearEnough: boolean;
  done: boolean;
  capReached: boolean;
  cycle: number;
  maxCycles: number;
  followupQuestion: string | null;
  refinedTopic: string | null;
}

type Turn = { role: "user" | "assistant"; text: string };

function OnboardingInner() {
  const router = useRouter();
  const isNew = useSearchParams().get("new") === "1";
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<ClarityResponse | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const description = input.trim();
    const firstMessage = turns.length === 0;
    setTurns((t) => [...t, { role: "user", text: description }]);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const res = await api<ClarityResponse>("/api/onboarding/clarity", {
        body: { description, restart: isNew && firstMessage },
      });
      if (res.done) {
        setDone(res);
        setTurns((t) => [
          ...t,
          { role: "assistant", text: `Great — we'll focus on: ${res.refinedTopic}` },
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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">What do you want to learn?</h1>
        <p className="text-muted-foreground text-sm">
          Describe it in detail. I&apos;ll ask follow-ups until it&apos;s clear
          enough to build a curriculum.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {turns.map((t, i) => (
          <Card
            key={i}
            className={t.role === "user" ? "bg-muted/50 ml-8" : "mr-8"}
          >
            <CardContent>
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                {t.role === "user" ? "You" : "LearnPath"}
              </p>
              <p className="text-sm whitespace-pre-wrap">{t.text}</p>
            </CardContent>
          </Card>
        ))}
        {busy && <Spinner className="text-muted-foreground" />}
      </div>

      {done ? (
        <Card className="border-primary/40">
          <CardContent className="flex items-center justify-between gap-3">
            <p className="text-sm">
              Topic locked in.
              {done.capReached && !done.clearEnough
                ? " (Proceeding with your description as-is.)"
                : ""}
            </p>
            <Button onClick={() => router.push("/assessment")}>
              Start quiz
              <ArrowRight data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={send} className="flex flex-col gap-2">
          <Textarea
            rows={3}
            placeholder="e.g. I want to learn React hooks to build a side project…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={busy} className="self-start">
            Send
          </Button>
        </form>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <OnboardingInner />
    </Suspense>
  );
}
