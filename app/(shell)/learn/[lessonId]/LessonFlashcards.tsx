"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Layers } from "lucide-react";
import { StatusIcon } from "@/components/StatusIcon";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import type { FlashcardDeckResult } from "@/lib/data/types";

const POLL_MS = 2500;
const POLL_TIMEOUT_MS = 2 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cards = (n: number) => `${n} flashcard${n === 1 ? "" : "s"}`;

/**
 * "Make flashcards" at the end of a lesson. The POST answers once the cards are
 * written; if another request is already writing them it says `generating` and
 * this POSTs again until they're ready. Once made, it links to the review page.
 */
export function LessonFlashcards({
  lessonId,
  curriculumId,
  initial,
}: {
  lessonId: string;
  curriculumId: string;
  initial: { made: boolean; cardCount: number };
}) {
  const router = useRouter();
  const [made, setMade] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function make() {
    setPending(true);
    setError("");
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    try {
      for (;;) {
        const res = await api<FlashcardDeckResult>(`/api/lesson/${lessonId}/flashcards`, {
          method: "POST",
        });
        if (!mounted.current) return;
        if (res.status === "ready") {
          setMade({ made: true, cardCount: res.cardCount });
          return;
        }
        if (Date.now() >= deadline) {
          throw new Error("This is taking longer than expected. Try again in a moment.");
        }
        await sleep(POLL_MS);
        if (!mounted.current) return;
      }
    } catch (err) {
      if (!mounted.current) return;
      if (err instanceof ApiClientError && err.status === 401) {
        router.push("/login");
        return;
      }
      if (err instanceof ApiClientError && err.status === 403) {
        router.refresh();
        return;
      }
      setError(err instanceof Error ? err.message : "Couldn't make flashcards.");
    } finally {
      if (mounted.current) setPending(false);
    }
  }

  return (
    <section className="bg-surface-1 border-border flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="bg-surface-2 border-border mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border">
          {pending ? (
            <StatusIcon status="generating" size={16} />
          ) : (
            <Layers aria-hidden className="text-muted-foreground size-4" />
          )}
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">
            {pending
              ? "Writing your cards"
              : made.made
                ? `${cards(made.cardCount)} from this lesson`
                : "Flashcards"}
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {pending
              ? "This takes a few seconds. You can keep reading."
              : made.made
                ? "They come back for review just before you'd forget them."
                : "Turn this lesson into cards you review later, spaced out so it sticks."}
          </p>
          {error && (
            <p role="status" className="text-muted-foreground text-xs">
              {error}
            </p>
          )}
        </div>
      </div>
      {made.made ? (
        <Button variant="secondary" size="sm" asChild className="self-start sm:self-auto">
          <Link href={`/flashcards?id=${curriculumId}`}>
            Review flashcards
            <ArrowUpRight data-icon="inline-end" />
          </Link>
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void make()}
          loading={pending}
          className="self-start sm:self-auto"
        >
          Make flashcards
        </Button>
      )}
    </section>
  );
}
