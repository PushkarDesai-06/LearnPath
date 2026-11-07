"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChatComposer } from "@/components/ChatComposer";
import { Eyebrow, PageHeader } from "@/components/PageHeader";
import { SetupSteps } from "@/components/SetupSteps";
import { cn } from "@/lib/utils";

export interface ClarityResponse {
  onboardingId?: string;
  clearEnough: boolean;
  done: boolean;
  capReached: boolean;
  cycle: number;
  maxCycles: number;
  followupQuestion: string | null;
  refinedTopic: string | null;
}

export type Turn = { role: "user" | "assistant"; text: string; failed?: boolean };
type LocalTurn = Turn & { id: string };

let seq = 0;
/** Local key for a turn, so a failed one can be retried or edited by identity. */
const nextId = () => `t${++seq}`;

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The clarity-loop chat. Any in-progress onboarding is resumed server-side and
 * arrives as `initialTurns` / `initialDone`, so there's no loading state. Once
 * the goal is clear it's shown back as a summary, ready for the quiz.
 */
export function OnboardingChat({
  isNew,
  initialOnboardingId,
  initialTurns,
  initialDone,
}: {
  isNew: boolean;
  initialOnboardingId: string | null;
  initialTurns: Turn[];
  initialDone: ClarityResponse | null;
}) {
  const router = useRouter();
  const [turns, setTurns] = useState<LocalTurn[]>(() =>
    initialTurns.map((t) => ({ ...t, id: nextId() })),
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ClarityResponse | null>(initialDone);
  // Pinned once the server has created or confirmed the setup, so follow-ups
  // and the quiz stay on THIS one.
  const [onboardingId, setOnboardingId] = useState(initialOnboardingId);
  const bottomRef = useRef<HTMLDivElement>(null);

  // A reply that lands after a restart belongs to the abandoned setup: each
  // request remembers the session it was sent in and is dropped if it changed.
  const [session, setSession] = useState(0);
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Once the server has created the setup, the URL names it (?ob=), so a reload
  // resumes this one. That also means a later "New topic" click (?new=1) is a
  // real change of search params, and starts over: the page keeps this
  // component mounted across it, so the reset happens here, during render.
  const startingFresh = useSearchParams().get("new") === "1";
  const [wasFresh, setWasFresh] = useState(startingFresh);
  if (startingFresh !== wasFresh) {
    setWasFresh(startingFresh);
    if (startingFresh) {
      setTurns([]);
      setInput("");
      setDone(null);
      setOnboardingId(null);
      setBusy(false);
      setSession((n) => n + 1);
    }
  }


  // Keep the latest message / thinking indicator in view as the chat grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "end",
    });
  }, [turns, busy, done]);

  async function deliver(description: string) {
    const id = nextId();
    const sentIn = sessionRef.current;
    const stale = () => sessionRef.current !== sentIn;
    setTurns((t) => [...t, { id, role: "user", text: description }]);
    setBusy(true);
    try {
      const res = await api<ClarityResponse>("/api/onboarding/clarity", {
        body: {
          description,
          // A "New topic" page starts a fresh setup until the server has one.
          restart: (isNew || startingFresh) && !onboardingId,
          onboardingId: onboardingId ?? undefined,
        },
      });
      if (stale()) return;
      if (res.onboardingId) {
        if (res.onboardingId !== onboardingId) {
          window.history.replaceState(null, "", `/onboarding?ob=${res.onboardingId}`);
        }
        setOnboardingId(res.onboardingId);
      }
      if (res.done) setDone(res);
      else
        setTurns((t) => [
          ...t,
          { id: nextId(), role: "assistant", text: res.followupQuestion ?? "Tell me more." },
        ]);
    } catch (err) {
      if (stale()) return;
      if (err instanceof ApiClientError && err.status === 401) {
        router.push("/login");
        return;
      }
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, failed: true } : x)));
      toast.error(err instanceof Error ? err.message : "Couldn't send that");
    } finally {
      if (!stale()) setBusy(false);
    }
  }

  function send() {
    if (busy) return;
    const description = input.trim();
    if (!description) return;
    setInput("");
    void deliver(description);
  }

  /** Drop a failed turn and resend it, or put it back in the box. */
  function recoverFailed(id: string, action: "retry" | "edit") {
    const failed = turns.find((t) => t.id === id && t.failed);
    if (!failed || busy) return;
    setTurns((t) => t.filter((x) => x.id !== id));
    if (action === "retry") void deliver(failed.text);
    else setInput(failed.text);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <SetupSteps current={0} />
      <PageHeader
        eyebrow="New topic"
        title="What do you want to learn?"
        description="Describe it in your own words. I'll ask follow-ups until it's clear enough to plan a curriculum."
      />

      <div className="flex flex-col gap-3">
        {turns.map((t) => (
          <div key={t.id} className={cn("flex flex-col gap-1", t.role === "user" ? "ml-8 items-end" : "mr-8")}>
            <Card
              className={cn(
                "animate-in fade-in-0 slide-in-from-bottom-2 w-full duration-300 ease-out",
                t.role === "user" && "bg-surface-2",
                t.failed && "opacity-60",
              )}
            >
              <CardContent className="flex flex-col gap-1">
                <Eyebrow>{t.role === "user" ? "You" : "LearnPath"}</Eyebrow>
                <p className="text-sm whitespace-pre-wrap">{t.text}</p>
              </CardContent>
            </Card>
            {t.failed && (
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                Not sent.
                <button
                  type="button"
                  onClick={() => recoverFailed(t.id, "retry")}
                  disabled={busy}
                  className="text-foreground inline-flex items-center gap-1 underline underline-offset-2"
                >
                  <RotateCw className="size-3" />
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => recoverFailed(t.id, "edit")}
                  disabled={busy}
                  className="text-foreground underline underline-offset-2"
                >
                  Edit
                </button>
              </p>
            )}
          </div>
        ))}
        {busy && (
          <Card className="animate-in fade-in-0 slide-in-from-bottom-2 mr-8 duration-300 ease-out">
            <CardContent className="flex flex-col gap-1">
              <Eyebrow>LearnPath</Eyebrow>
              <span className="flex items-center gap-1.5" role="status">
                <span className="bg-muted-foreground/70 size-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
                <span className="bg-muted-foreground/70 size-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
                <span className="bg-muted-foreground/70 size-1.5 animate-bounce rounded-full" />
                <span className="text-muted-foreground ml-1.5 text-xs">Thinking…</span>
              </span>
            </CardContent>
          </Card>
        )}
      </div>

      {done ? (
        <Card
          role="status"
          className="border-primary/30 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out"
        >
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Eyebrow>Your goal</Eyebrow>
              <p className="font-heading text-lg leading-snug font-medium">
                {done.refinedTopic}
              </p>
              {done.capReached && !done.clearEnough && (
                <p className="text-muted-foreground text-xs">
                  Going with your description as written.
                </p>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              Next, a short multiple-choice check finds where you already are, so the path skips
              what you know.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild>
                <Link href={onboardingId ? `/assessment?ob=${onboardingId}` : "/assessment"}>
                  Start the quiz
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/onboarding?new=1">Describe something else</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ChatComposer
          id="onboarding-message"
          label="Describe what you want to learn"
          autoFocus
          value={input}
          onChange={setInput}
          onSubmit={send}
          placeholder="e.g. I want to learn React hooks to build a side project…"
          submitLabel="Send"
          busy={busy}
        />
      )}

      {/* Scroll target: kept below the composer so it stays in view. */}
      <div ref={bottomRef} aria-hidden />
    </div>
  );
}
