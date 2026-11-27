"use client";

import Link from "next/link";
import { MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusIcon } from "@/components/StatusIcon";
import type { RowMenuEntry } from "@/components/shell/rowMenus";
import { formatRelativeDay } from "@/lib/client/dates";
import { STATUS_LABELS, type ListLesson } from "@/lib/client/lessonGroups";
import { MenuButton } from "./LessonMenuButton";

interface LessonPeekProps {
  lesson: ListLesson | null;
  open: boolean;
  mobile: boolean;
  curriculumId: string;
  timeZone: string;
  entries: RowMenuEntry[];
  onClose: () => void;
}

function PeekBody({
  lesson,
  curriculumId,
  timeZone,
  entries,
}: Pick<LessonPeekProps, "curriculumId" | "timeZone" | "entries"> & {
  lesson: ListLesson;
}) {
  const percent = Math.round(lesson.masteryScore * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <p className="truncate text-xs text-muted-foreground">{lesson.moduleTitle}</p>
        <h2 className="text-[15px] leading-snug font-semibold [overflow-wrap:anywhere]">
          {lesson.title}
        </h2>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 text-fg-2">
            <StatusIcon
              status={lesson.displayStatus}
              mastery={lesson.masteryScore}
              animate={false}
            />
            {STATUS_LABELS[lesson.displayStatus]}
          </span>
          <span aria-hidden>·</span>
          <span className="capitalize">{lesson.difficultyLevel}</span>
          <span aria-hidden>·</span>
          <span>~{lesson.estMinutes} min</span>
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Mastery</span>
          <span className="font-medium tabular-nums">{percent}%</span>
        </div>
        <div
          role="meter"
          aria-label="Mastery"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-1 overflow-hidden rounded-full bg-surface-3"
        >
          <div
            className="h-full origin-left rounded-full bg-foreground transition-transform duration-(--dur-slow) ease-(--ease-out)"
            style={{ transform: `scaleX(${lesson.masteryScore})` }}
          />
        </div>
      </div>

      {lesson.objectives.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-medium text-muted-foreground">Objectives</h3>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-[12.5px] text-fg-2 marker:text-faint">
            {lesson.objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Last practiced{" "}
        <span className="text-fg-2">
          {lesson.lastPracticedAt
            ? formatRelativeDay(lesson.lastPracticedAt, timeZone)
            : "Not yet"}
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <Button size="sm" asChild>
          <Link href={`/learn/${lesson.id}`}>Open lesson</Link>
        </Button>
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/tutor?id=${curriculumId}&lesson=${encodeURIComponent(lesson.id)}`}>
            <MessageSquare data-icon="inline-start" />
            Ask tutor
          </Link>
        </Button>
        <MenuButton entries={entries} label="Lesson actions" />
      </div>
    </div>
  );
}

export function LessonPeek({
  lesson,
  open,
  mobile,
  curriculumId,
  timeZone,
  entries,
  onClose,
}: LessonPeekProps) {
  if (mobile) {
    return (
      <Sheet
        open={open && lesson !== null}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-xl p-4"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onClose();
          }}
        >
          <SheetTitle className="sr-only">{lesson?.title ?? "Lesson"}</SheetTitle>
          <SheetDescription className="sr-only">Lesson details</SheetDescription>
          {lesson && (
            <PeekBody
              lesson={lesson}
              curriculumId={curriculumId}
              timeZone={timeZone}
              entries={entries}
            />
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      aria-label="Lesson details"
      aria-hidden={!open}
      inert={!open}
      className={
        "fixed top-11 right-0 bottom-0 z-30 w-[340px] overflow-y-auto border-l border-border bg-surface-1 p-4 shadow-(--shadow-pop) transition-transform duration-(--dur-slow) ease-(--ease-out) motion-reduce:transition-none " +
        (open ? "translate-x-0" : "translate-x-full")
      }
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Close details"
        className="absolute top-3 right-3"
        onClick={onClose}
      >
        <X />
      </Button>
      {lesson && (
        <div className="pr-8">
          <PeekBody
            lesson={lesson}
            curriculumId={curriculumId}
            timeZone={timeZone}
            entries={entries}
          />
        </div>
      )}
    </aside>
  );
}
