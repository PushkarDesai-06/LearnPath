"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/icons/animated";
import {
  AssistantAvatar,
  AssistantTurn,
  ChatComposer,
  TypingBars,
  UserBubble,
} from "@/components/chat/ChatParts";

export interface ClarityResponse {
  clearEnough: boolean;
  done: boolean;
  capReached: boolean;
  cycle: number;
  maxCycles: number;
  followupQuestion: string | null;
  refinedTopic: string | null;
}

export type Turn = { role: "user" | "assistant"; text: string };

/**
 * The clarity-loop chat. Any in-progress onboarding is resumed server-side and
 * arrives as `initialTurns` / `initialDone`, so there's no loading state.
 */
export function OnboardingChat({
  isNew,
  initialTurns,
  initialDone,
}: {
  isNew: boolean;
  initialTurns: Turn[];
  initialDone: ClarityResponse | null;
}) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ClarityResponse | null>(initialDone);
  const bottomRef = useRef<HTMLDivElement>(null);

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
          { role: "assistant", text: `Great, we'll focus on: ${res.refinedTopic}` },
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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight">
          What do you want to learn?
        </h1>
        <p className="text-[13px] text-muted-foreground">
          Describe it in your own words. I&apos;ll ask follow-ups until it&apos;s
          clear enough to plan a curriculum.
        </p>
      </header>

      <div className="flex flex-col gap-5">
        {turns.map((t, i) =>
          t.role === "user" ? (
            <UserBubble key={i}>{t.text}</UserBubble>
          ) : (
            <AssistantTurn key={i}>
              <p className="whitespace-pre-wrap">{t.text}</p>
            </AssistantTurn>
          ),
        )}
        {busy && (
          <div className="flex items-center gap-3">
            <AssistantAvatar className="mt-0" />
            <TypingBars label="LearnPath is thinking" />
          </div>
        )}
      </div>

      {done ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border-strong bg-surface-1 p-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-(--dur-base) ease-(--ease-out)">
          <p className="flex items-center gap-2 text-[13px]">
            <Check className="size-4 shrink-0" aria-hidden />
            Topic locked in.
            {done.capReached && !done.clearEnough
              ? " Proceeding with your description as-is."
              : ""}
          </p>
          <Button asChild className="group">
            <Link href="/assessment">
              Start quiz
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      ) : (
        <ChatComposer
          autoFocus
          label="Describe what you want to learn"
          placeholder="e.g. I want to learn React hooks to build a side project"
          value={input}
          onChange={setInput}
          onSubmit={() => void send()}
          busy={busy}
        />
      )}
      {/* Scroll target: kept below the composer so it stays in view. */}
      <div ref={bottomRef} aria-hidden />
    </div>
  );
}
