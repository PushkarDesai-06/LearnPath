import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/icons/animated";
import { StatusIcon, type StatusIconStatus } from "@/components/StatusIcon";
import type { DashboardLesson, RecommendedNext } from "@/lib/data/types";

const cards = (count: number) => `${count} flashcard${count === 1 ? "" : "s"}`;

export function ContinueCard({
  next,
  lesson,
  curriculumId,
  dueCards,
}: {
  next: RecommendedNext | null;
  lesson: DashboardLesson | null;
  curriculumId: string;
  dueCards: number;
}) {
  const reviewLink =
    dueCards > 0 ? (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/flashcards?id=${curriculumId}`}>
          Review {cards(dueCards)}
        </Link>
      </Button>
    ) : null;

  if (!next) {
    return (
      <section className="flex items-center gap-4 rounded-xl bg-surface-1 px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--border)]">
        <CircleCheck className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">You are all caught up</p>
          <p className="text-[11.5px] text-muted-foreground">
            Nothing is waiting for you in this path right now.
          </p>
        </div>
        {reviewLink}
      </section>
    );
  }

  const status: StatusIconStatus =
    next.reason === "needs_review"
      ? "needs_review"
      : ((lesson?.status as StatusIconStatus | undefined) ?? "available");

  return (
    <section className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-surface-1 px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--border)] transition-shadow duration-(--dur-base) hover:shadow-[inset_0_0_0_1px_var(--border-strong)]">
      <StatusIcon
        status={status}
        mastery={next.masteryScore}
        size={20}
      />
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-[11.5px] text-muted-foreground">
          {next.reason === "needs_review"
            ? "Pick up a review"
            : "Pick up where you left off"}
        </p>
        <p className="truncate text-[15px] font-semibold">{next.lessonTitle}</p>
        <p className="truncate text-[11.5px] text-muted-foreground">
          {next.moduleTitle}
          {lesson ? ` · ~${lesson.estMinutes} min` : ""}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {reviewLink}
        <Button asChild className="group">
          <Link href={`/learn/${next.lessonId}`}>
            Continue
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
