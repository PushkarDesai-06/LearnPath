"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";
import {
  FLASHCARD_GRADES,
  formatInterval,
  previewIntervals,
  scheduleCard,
} from "@/lib/domain/flashcards";
import type { FlashcardGrade } from "@/lib/db/models";
import type { FlashcardDTO, FlashcardReviewResult } from "@/lib/data/types";

const GRADE_LABELS: Record<FlashcardGrade, string> = {
  again: "Again",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};

/**
 * One review sitting over the cards that were due when the page loaded. Show
 * the front, reveal the back, then grade it: the card leaves the queue at once
 * and the grade saves in the background. "Again" puts the card back at the end
 * of this sitting. Keys: Space or Enter reveals, 1 to 4 grade.
 *
 * Once the queue is empty and every grade has saved, the server tree is
 * refreshed so the page's counts catch up. This island stays mounted through
 * that refresh, so the summary survives it. With nothing due on arrival it
 * shows the server's "all caught up" note instead.
 */
export function ReviewSession({
  curriculumId,
  initialCards,
  initialNextDueAt,
  caughtUpNote,
}: {
  curriculumId: string;
  initialCards: FlashcardDTO[];
  initialNextDueAt: string | null;
  /** Shown when nothing was due on arrival, e.g. "The next card is due in 1d." */
  caughtUpNote: string;
}) {
  const router = useRouter();
  const [queue, setQueue] = useState(initialCards);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Soonest due date outside this sitting, and when the sitting ended, so the
  // done screen can say "next card in 3d" without reading the clock in render.
  const [nextDue, setNextDue] = useState(() =>
    initialNextDueAt ? Date.parse(initialNextDueAt) : null,
  );
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const inFlight = useRef(0);
  const drained = useRef(initialCards.length === 0);

  const card = queue[0];

  /** Wraps each save; refreshes the page's counts after the last one lands. */
  function track<T>(request: Promise<T>): Promise<T> {
    inFlight.current++;
    return request.finally(() => {
      inFlight.current--;
      if (inFlight.current === 0 && drained.current) router.refresh();
    });
  }

  function requeue(update: (q: FlashcardDTO[]) => FlashcardDTO[]) {
    drained.current = false;
    setQueue(update);
    setFinishedAt(null);
  }

  function handleFailure(err: unknown, fallback: string): boolean {
    if (err instanceof ApiClientError && err.status === 401) {
      router.push("/login");
      return true;
    }
    toast.error(err instanceof Error ? err.message : fallback);
    return false;
  }

  function advance(rest: FlashcardDTO[]) {
    setQueue(rest);
    setRevealed(false);
    setConfirmRemove(false);
    drained.current = rest.length === 0;
    if (!rest.length) setFinishedAt(Date.now());
  }

  function grade(g: FlashcardGrade) {
    if (!card || !revealed) return;
    const rest = queue.slice(1);
    // "Again" comes back in this sitting with its relearning schedule.
    const local = scheduleCard(card.schedule, g);
    const requeued = g === "again" ? [...rest, { ...card, schedule: local }] : rest;
    advance(requeued);
    setReviewed((n) => n + 1);

    track(api<FlashcardReviewResult>(`/api/flashcards/${card.id}/review`, { body: { grade: g } }))
      .then((res) => {
        if (g === "again") {
          setQueue((q) => q.map((c) => (c.id === card.id ? { ...c, schedule: res.schedule } : c)));
        } else {
          const due = Date.parse(res.due);
          setNextDue((n) => (n === null ? due : Math.min(n, due)));
        }
      })
      .catch((err) => {
        if (handleFailure(err, "Couldn't save that review.")) return;
        if (err instanceof ApiClientError && err.status === 409) return; // graded elsewhere
        // Put it back so the grade isn't silently lost.
        requeue((q) => [card, ...q.filter((c) => c.id !== card.id)]);
        setReviewed((n) => Math.max(0, n - 1));
      });
  }

  function remove() {
    if (!card) return;
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    advance(queue.slice(1));
    track(api(`/api/flashcards/${card.id}`, { method: "DELETE" }))
      .then(() => toast.success("Card removed."))
      .catch((err) => {
        if (handleFailure(err, "Couldn't remove that card.")) return;
        requeue((q) => [card, ...q]);
      });
  }

  // Keyboard review. Re-bound when the card or its side changes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!card || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
        return;
      }
      const index = Number(e.key) - 1;
      if (revealed && index >= 0 && index < FLASHCARD_GRADES.length) {
        e.preventDefault();
        grade(FLASHCARD_GRADES[index]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!card) {
    const sat = reviewed > 0;
    return (
      <section className="border-border/60 bg-surface-1/60 flex flex-col items-center gap-3 rounded-2xl border px-6 py-12 text-center">
        <p className="h-display text-2xl">{sat ? "Done for now" : "All caught up"}</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          {sat
            ? `You reviewed ${reviewed} card${reviewed === 1 ? "" : "s"}.` +
              (nextDue !== null && finishedAt !== null
                ? ` The next one is due in ${formatInterval(nextDue - finishedAt)}.`
                : "")
            : caughtUpNote}
        </p>
        <Button asChild variant="secondary" size="sm" className="mt-2">
          <Link href={`/dashboard?id=${curriculumId}`}>Back to path</Link>
        </Button>
      </section>
    );
  }

  const total = reviewed + queue.length;
  const intervals = previewIntervals(card.schedule);

  return (
    <section className="flex flex-col gap-4" aria-label="Review">
      <div className="flex items-center gap-3">
        <Progress value={(reviewed / total) * 100} className="flex-1" />
        <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
          {queue.length} left
        </span>
      </div>

      <div className="border-border/60 bg-surface-1/60 flex min-h-72 flex-col rounded-2xl border">
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-10 text-center">
          <Markdown className="prose-p:my-0 text-lg sm:prose-base max-w-xl text-pretty [overflow-wrap:anywhere]">
            {card.front}
          </Markdown>
          {revealed && (
            <>
              <div className="bg-border h-px w-16" />
              <Markdown className="text-foreground/85 animate-in fade-in-0 prose-p:my-0 max-w-xl text-pretty [overflow-wrap:anywhere] duration-200">
                {card.back}
              </Markdown>
            </>
          )}
        </div>
        <div className="border-border/60 text-muted-foreground flex items-center justify-between gap-3 border-t px-4 py-2.5 text-xs">
          <Link
            href={`/learn/${card.lessonRef}`}
            className="hover:text-foreground min-w-0 truncate transition-colors"
          >
            From {card.lessonTitle}
          </Link>
          <button
            type="button"
            onClick={remove}
            onBlur={() => setConfirmRemove(false)}
            className={cn(
              "shrink-0 transition-colors",
              confirmRemove ? "text-destructive" : "hover:text-foreground",
            )}
          >
            {confirmRemove ? "Remove this card?" : "Remove card"}
          </button>
        </div>
      </div>

      {revealed ? (
        <div className="grid grid-cols-4 gap-2">
          {FLASHCARD_GRADES.map((g, i) => (
            <Button
              key={g}
              variant={g === "good" ? "default" : "secondary"}
              onClick={() => grade(g)}
              className="h-auto flex-col gap-0.5 py-2"
            >
              <span>{GRADE_LABELS[g]}</span>
              <span className="font-mono text-[10px] font-normal opacity-70">
                {intervals[g]}
                <span className="hidden sm:inline"> · {i + 1}</span>
              </span>
            </Button>
          ))}
        </div>
      ) : (
        <Button onClick={() => setRevealed(true)} className="h-auto py-3">
          Show answer
          <span className="hidden font-mono text-[10px] font-normal opacity-70 sm:inline">Space</span>
        </Button>
      )}
    </section>
  );
}
