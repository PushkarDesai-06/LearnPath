"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingRing } from "@/components/ui/loading-ring";

/** "Mark complete" — finalizes mastery and re-adapts the path server-side. */
export function LessonFooter({
  curriculumId,
  lessonRef,
}: {
  curriculumId: string;
  lessonRef: string;
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
      // Re-render the server tree so the Nav's mastery (and any cached
      // dashboard payload) reflect the new standing.
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="border-border mt-4 flex items-center justify-between gap-3 border-t pt-6">
      {completed ? (
        <>
          <Badge variant="status" tone="mastered">
            <CheckCircle2 data-icon="inline-start" />
            Complete
          </Badge>
          <Button asChild>
            <Link href={`/dashboard?id=${curriculumId}`}>Back to path</Link>
          </Button>
        </>
      ) : (
        <>
          <span className="text-muted-foreground text-sm">
            Done reading and practicing?
          </span>
          <Button onClick={markComplete} disabled={completing}>
            {completing && <LoadingRing data-icon="inline-start" />}
            Mark complete
          </Button>
        </>
      )}
    </div>
  );
}
