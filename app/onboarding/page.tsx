"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Send } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

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
  const [done, setDone] = useState<ClarityResponse | null>(null);
  // Don't auto-resume when the learner explicitly started a NEW topic.
  const [loading, setLoading] = useState(!isNew);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Resume an in-progress onboarding so the past questions aren't lost.
  useEffect(() => {
    if (isNew) return;
    let active = true;
    api<{
      onboarding: {
        status: string;
        refinedTopic: string | null;
        cycle: number;
        maxCycles: number;
        exchanges: { role: "user" | "assistant"; text: string }[];
      } | null;
    }>("/api/onboarding")
      .then((res) => {
        if (!active) return;
        const ob = res.onboarding;
        if (ob?.status === "clarifying" && ob.exchanges.length > 0) {
          setTurns(ob.exchanges.map((e) => ({ role: e.role, text: e.text })));
        } else if (ob?.status === "ready") {
          setDone({
            clearEnough: true,
            done: true,
            capReached: false,
            cycle: ob.cycle,
            maxCycles: ob.maxCycles,
            followupQuestion: null,
            refinedTopic: ob.refinedTopic,
          });
        }
      })
      .catch((err) => {
        if (active && err instanceof ApiClientError && err.status === 401)
          router.push("/login");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [isNew, router]);

  // Keep the latest message / thinking indicator in view as the chat grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  async function send() {
    if (busy) return;
    const description = input.trim();
    if (!description) return;
    const firstMessage = turns.length === 0;
    setTurns((t) => [...t, { role: "user", text: description }]);
    setInput("");
    setBusy(true);
    try {
      const res = await api<ClarityResponse>("/api/onboarding/clarity", {
        body: { description, restart: isNew && firstMessage },
      });
      if (res.done) {
        setDone(res);
        toast.success(`Topic ready: ${res.refinedTopic}`);
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
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
          Setup
        </p>
        <h1 className="h-display text-3xl">What do you want to learn?</h1>
        <p className="text-muted-foreground text-sm">
          Describe it in your own words. I&apos;ll ask follow-ups until it&apos;s
          clear enough to plan a curriculum.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {turns.map((t, i) => (
          <Card
            key={i}
            className={cn(
              "animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out",
              t.role === "user" ? "bg-muted/50 ml-8" : "mr-8",
            )}
          >
            <CardContent>
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                {t.role === "user" ? "You" : "LearnPath"}
              </p>
              <p className="text-sm whitespace-pre-wrap">{t.text}</p>
            </CardContent>
          </Card>
        ))}
        {busy && (
          <Card className="animate-in fade-in-0 slide-in-from-bottom-2 mr-8 duration-300 ease-out">
            <CardContent>
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                LearnPath
              </p>
              <span
                className="flex items-center gap-1.5"
                role="status"
                aria-label="LearnPath is thinking"
              >
                <span className="bg-muted-foreground/70 size-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
                <span className="bg-muted-foreground/70 size-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
                <span className="bg-muted-foreground/70 size-1.5 animate-bounce rounded-full" />
                <span className="text-muted-foreground ml-1.5 text-xs">
                  Thinking…
                </span>
              </span>
            </CardContent>
          </Card>
        )}
      </div>

      {done ? (
        <Card className="border-primary/40 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out">
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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="bg-surface-1 border-border focus-within:border-primary/30 flex flex-col gap-1 rounded-xl border p-3 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] transition-colors"
        >
          <Textarea
            autoFocus
            rows={2}
            placeholder="e.g. I want to learn React hooks to build a side project…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Ignore Enter while an IME is composing a character.
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            className="min-h-[60px] resize-none border-0 bg-transparent p-1 px-2.5 py-1.5 shadow-none focus-visible:ring-0"
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-muted-foreground/60 font-inter text-[10px] uppercase tracking-tight">
              ↵ to send · ⇧↵ for newline
            </span>
            <Button type="submit" size="sm" disabled={busy || !input.trim()}>
              {busy ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Send data-icon="inline-start" />
              )}
              Send
            </Button>
          </div>
        </form>
      )}
      {/* Scroll target: kept below the composer so it stays in view. */}
      <div ref={bottomRef} aria-hidden />
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
