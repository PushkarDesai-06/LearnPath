"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/client/api";
import { ArrowUpRight, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { LoadingRing } from "@/components/ui/loading-ring";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Markdown } from "@/components/Markdown";
import { StatusIcon } from "@/components/StatusIcon";
import { hasOpenOverlay } from "@/lib/client/keys";
import { cn } from "@/lib/utils";
import {
  FLASHCARD_GRADES,
  formatInterval,
  previewIntervals,
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
 * of this sitting once that save lands. Keys: Space or Enter reveals (unless a
 * control has focus), 1 to 4 grade. Keys are ignored while a menu or dialog is open.
 *
 * Once the queue is empty and every grade has saved, the server tree is
 * refreshed so the page's counts catch up. This island stays mounted through
 * that refresh, so the summary survives it, and if more cards were due than one
 * session holds, the refreshed batch starts straight away. With nothing due on
 * arrival it shows the server's "all caught up" note instead.
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
  // The batch the queue was last filled from. A refresh after the queue drains
  // brings the next batch (when more were due than one session holds); a new
  // `initialCards` prop doesn't reset useState, so adopt it here.
  const [batch, setBatch] = useState(initialCards);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Soonest due date outside this sitting, and when the sitting ended, so the
  // done screen can say "next card in 3d" without reading the clock in render.
  const [nextDue, setNextDue] = useState(() =>
    initialNextDueAt ? Date.parse(initialNextDueAt) : null,
  );
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  /** Saves in flight. The sitting isn't over until they land. */
  const [saving, setSaving] = useState(0);
  const saved = useRef(false);

  if (batch !== initialCards) {
    setBatch(initialCards);
    if (!queue.length && !saving && initialCards.length) {
      setQueue(initialCards);
      setRevealed(false);
      setFinishedAt(null);
    }
  }

  const card = queue[0];

  // Once the queue is empty and every save has landed, refresh the server tree
  // so the page's counts catch up (and the next batch arrives, if any).
  useEffect(() => {
    if (saving || queue.length || !saved.current) return;
    saved.current = false;
    router.refresh();
  }, [saving, queue.length, router]);

  function track<T>(request: Promise<T>): Promise<T> {
    setSaving((n) => n + 1);
    return request.finally(() => {
      saved.current = true;
      setSaving((n) => n - 1);
    });
  }

  function requeue(update: (q: FlashcardDTO[]) => FlashcardDTO[]) {
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
    if (!rest.length) setFinishedAt(Date.now());
  }

  function grade(g: FlashcardGrade) {
    if (!card || !revealed) return;
    // Every grade leaves the queue at once. "Again" comes back at the end of
    // this sitting, but only after its save lands: grading it again sooner
    // would race that save on the same review count.
    advance(queue.slice(1));
    setReviewed((n) => n + 1);

    track(api<FlashcardReviewResult>(`/api/flashcards/${card.id}/review`, { body: { grade: g } }))
      .then((res) => {
        if (g === "again") {
          requeue((q) => [...q, { ...card, schedule: res.schedule }]);
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
      if (!card || e.metaKey || e.ctrlKey || e.altKey || hasOpenOverlay()) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      // A focused control keeps its own Space/Enter (Show answer included).
      const onControl = !!target?.closest("button, a, [role=button]");
      if (!revealed && !onControl && (e.key === " " || e.key === "Enter")) {
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

  if (!card && saving) {
    // The last grades are still saving (an "again" card may be about to return).
    return (
      <section className="flex min-h-72 items-center justify-center gap-2 rounded-xl border border-border bg-surface-1 text-[13px] text-muted-foreground">
        <LoadingRing className="size-3.5 text-current" />
        Saving
      </section>
    );
  }

  if (!card) {
    const sat = reviewed > 0;
    return (
      <section className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-1 px-6 py-12 text-center animate-in fade-in-0 zoom-in-95 duration-(--dur-slow) ease-(--ease-out)">
        <StatusIcon status="mastered" size={28} label="Done" />
        <p className="text-lg font-semibold tracking-tight">
          {sat ? "Done for now" : "All caught up"}
        </p>
        {sat && (
          <p className="font-mono text-3xl tabular-nums">{reviewed}</p>
        )}
        <p className="max-w-sm text-[13px] text-muted-foreground">
          {sat
            ? `You reviewed ${reviewed === 1 ? "a card" : "cards"}.` +
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
        <Progress
          value={(reviewed / total) * 100}
          aria-label="Session progress"
          className="flex-1"
        />
        <span className="font-mono text-[11px] tabular-nums text-faint">
          {reviewed}/{total}
        </span>
      </div>

      <div className="relative">
        <div className="absolute top-2 right-2 z-10">
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Card options">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Card options</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href={`/learn/${card.lessonRef}`}>
                  <ArrowUpRight />
                  Open source lesson
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirmRemove(true)}
              >
                <Trash2 />
                Delete card
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="[perspective:1400px]">
          <div
            className={cn(
              "grid min-h-72 [transform-style:preserve-3d] transition-transform duration-500 ease-(--ease-out) motion-reduce:transition-none",
              revealed && "motion-safe:[transform:rotateY(180deg)]",
            )}
          >
            <div
              aria-hidden={revealed}
              className={cn(
                "col-start-1 row-start-1 flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-surface-1 px-8 py-12 text-center [backface-visibility:hidden] motion-reduce:transition-opacity motion-reduce:duration-200",
                revealed && "motion-reduce:opacity-0",
              )}
            >
              <Markdown className="max-w-xl text-pretty prose-p:my-0 sm:prose-base [overflow-wrap:anywhere]">
                {card.front}
              </Markdown>
            </div>
            <div
              aria-hidden={!revealed}
              className={cn(
                "col-start-1 row-start-1 flex flex-col items-center justify-center gap-4 rounded-xl border border-border-strong bg-surface-2 px-8 py-12 text-center [backface-visibility:hidden] [transform:rotateY(180deg)] motion-reduce:opacity-100 motion-reduce:transition-opacity motion-reduce:duration-200 motion-reduce:[transform:none]",
                !revealed && "motion-reduce:opacity-0",
              )}
            >
              <Markdown className="max-w-xl text-[13px] text-pretty text-muted-foreground prose-p:my-0 [overflow-wrap:anywhere]">
                {card.front}
              </Markdown>
              <div className="h-px w-12 bg-border-strong" />
              <Markdown className="max-w-xl text-pretty prose-p:my-0 sm:prose-base [overflow-wrap:anywhere]">
                {card.back}
              </Markdown>
            </div>
          </div>
        </div>
      </div>

      <Link
        href={`/learn/${card.lessonRef}`}
        className="min-w-0 self-center truncate text-[12px] text-faint transition-colors duration-(--dur-fast) hover:text-foreground"
      >
        From {card.lessonTitle}
      </Link>

      {revealed ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FLASHCARD_GRADES.map((g, i) => (
            <Button
              key={g}
              variant={g === "good" ? "default" : "secondary"}
              onClick={() => grade(g)}
              className="h-auto flex-col gap-0.5 py-2"
            >
              <span className="flex items-center gap-1.5">
                {GRADE_LABELS[g]}
                <Kbd className="hidden sm:inline-flex">{i + 1}</Kbd>
              </span>
              <span className="font-mono text-[10.5px] font-normal opacity-70">
                {intervals[g]}
              </span>
            </Button>
          ))}
        </div>
      ) : (
        <Button
          onClick={() => setRevealed(true)}
          variant="secondary"
          className="h-auto gap-2 py-2.5"
        >
          Show answer
          <Kbd className="hidden sm:inline-flex">Space</Kbd>
        </Button>
      )}

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this card?</AlertDialogTitle>
            <AlertDialogDescription>
              It leaves your deck for good. The lesson it came from is not
              affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              Delete card
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
