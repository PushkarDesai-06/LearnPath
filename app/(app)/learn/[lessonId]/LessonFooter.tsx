"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingRing } from "@/components/ui/loading-ring";

interface NextLesson {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
}

/**
 * "Mark complete" finalizes mastery and re-adapts the path server-side; the
 * response says what to open next, read from the ADAPTED path (completion can
 * reorder lessons and open a module), so the next step is offered right here.
 */
export function LessonFooter({
  curriculumId,
  lessonRef,
  initiallyCompleted,
  initialNext,
}: {
  curriculumId: string;
  lessonRef: string;
  initiallyCompleted: boolean;
  /** Server pick for an already-completed lesson; refreshes with the page. */
  initialNext: NextLesson | null;
}) {
  const router = useRouter();
  // Client clock on purpose: a server-supplied start time would count render
  // and network time, and differ between renders.
  const [startedAt] = useState(() => Date.now());
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(initiallyCompleted);
  // The completion response's pick bridges the gap until the refreshed server
  // render (which then knows the lesson is complete) takes over.
  const [completedNext, setCompletedNext] = useState<NextLesson | null>(null);
  const next = initiallyCompleted ? initialNext : completedNext;
  const pathHref = `/dashboard?id=${curriculumId}`;

  async function markComplete() {
    setCompleting(true);
    try {
      const res = await api<{ next: NextLesson | null }>("/api/progress/complete", {
        body: { curriculumId, lessonRef, timeSpentMs: Date.now() - startedAt },
      });
      setCompleted(true);
      setCompletedNext(res.next);
      // Re-render the server tree so the topic bar's mastery (and any cached
      // dashboard payload) reflect the new standing.
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your progress");
    } finally {
      setCompleting(false);
    }
  }

  if (!completed) {
    return (
      <div className="border-border mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        <span className="text-muted-foreground text-sm">Done reading and practicing?</span>
        <Button onClick={markComplete} disabled={completing}>
          {completing && <LoadingRing data-icon="inline-start" className="text-current" />}
          Mark complete
        </Button>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="border-border animate-in fade-in-0 mt-4 flex flex-col gap-4 border-t pt-6 duration-300 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-1.5">
        <Badge variant="status" tone="mastered" className="self-start">
          <CheckCircle2 data-icon="inline-start" />
          Complete
        </Badge>
        {next && (
          <p className="text-muted-foreground text-sm">
            Up next: <span className="text-foreground">{next.lessonTitle}</span>
            <span className="text-muted-foreground"> in {next.moduleTitle}</span>
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button variant={next ? "secondary" : "default"} asChild>
          <Link href={pathHref}>Back to path</Link>
        </Button>
        {next && (
          <Button asChild>
            <Link href={`/learn/${next.lessonId}`}>
              Next lesson
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
