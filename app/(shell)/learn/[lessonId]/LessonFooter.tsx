"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/icons/animated";
import { StatusIcon } from "@/components/StatusIcon";
import type { LessonNeighbor } from "./LessonControls";

/** "Mark complete" finalizes mastery and re-adapts the path server-side. */
export function LessonFooter({
  curriculumId,
  lessonRef,
  next,
}: {
  curriculumId: string;
  lessonRef: string;
  next: LessonNeighbor | null;
}) {
  const router = useRouter();
  // Client clock on purpose: a server-supplied start time would count render
  // and network time, and differ between renders.
  const [startedAt] = useState(() => Date.now());
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function markComplete() {
    setCompleting(true);
    try {
      await api("/api/progress/complete", {
        body: {
          curriculumId,
          lessonRef,
          timeSpentMs: Date.now() - startedAt,
        },
      });
      setCompleted(true);
      toast.success("Lesson complete. Path updated.");
      // Re-render the server tree so the sidebar's mastery (and any cached
      // dashboard payload) reflect the new standing.
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="border-border mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
      {completed ? (
        <>
          <p className="animate-in fade-in-0 flex items-center gap-2 text-sm font-medium duration-300">
            <StatusIcon status="mastered" size={20} />
            Lesson complete
          </p>
          {next && !next.locked ? (
            <Button asChild size="lg" className="group">
              <Link href={`/learn/${next.id}`}>
                Next lesson
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link href={`/dashboard?id=${curriculumId}`}>Back to path</Link>
            </Button>
          )}
        </>
      ) : (
        <>
          <span className="text-muted-foreground text-sm">
            Done reading and practicing?
          </span>
          <Button size="lg" onClick={markComplete} loading={completing}>
            Mark complete
          </Button>
        </>
      )}
    </div>
  );
}
