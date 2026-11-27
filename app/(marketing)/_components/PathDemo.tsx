"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { StatusIcon, type StatusIconStatus } from "@/components/StatusIcon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "./useInView";

type Lesson = { id: string; title: string; status: StatusIconStatus; mastery?: number };

const LESSONS: readonly Lesson[] = [
  { id: "series", title: "Series and DataFrames", status: "mastered" },
  { id: "filter", title: "Filtering rows", status: "in_progress", mastery: 0.6 },
  { id: "group", title: "Group and aggregate", status: "available" },
  { id: "merge", title: "Merging tables", status: "locked" },
  { id: "missing", title: "Handling missing values", status: "mastered" },
];

const RESTING = LESSONS.map((lesson) => lesson.id);
const HOISTED = ["series", "missing", "filter", "group", "merge"];
const SLIPPED = "missing";
const FLIP_MS = 460;

export function PathDemo() {
  const [slipped, setSlipped] = useState(false);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const order = slipped ? HOISTED : RESTING;

  function toggle() {
    const first = new Map<string, number>();
    rows.current.forEach((row, id) => first.set(id, row.getBoundingClientRect().top));
    flushSync(() => setSlipped((value) => !value));
    if (prefersReducedMotion()) return;
    rows.current.forEach((row, id) => {
      const shift = (first.get(id) ?? 0) - row.getBoundingClientRect().top;
      if (!shift) return;
      row.animate(
        [{ transform: `translateY(${shift}px)` }, { transform: "none" }],
        { duration: FLIP_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    });
  }

  return (
    <div className="bg-surface-2 border-border flex flex-col gap-3 rounded-xl border p-3.5">
      <ul className="bg-surface-1 border-border divide-border flex flex-col divide-y rounded-lg border">
        {order.map((id) => {
          const lesson = LESSONS.find((item) => item.id === id)!;
          const isSlipped = slipped && id === SLIPPED;
          return (
            <li
              key={id}
              ref={(node) => {
                if (node) rows.current.set(id, node);
                else rows.current.delete(id);
              }}
              className={cn(
                "bg-surface-1 flex h-9 items-center gap-2.5 px-3 text-[13px] transition-colors duration-(--dur-slow) first:rounded-t-lg last:rounded-b-lg",
                isSlipped && "bg-active",
              )}
            >
              <StatusIcon
                status={isSlipped ? "needs_review" : lesson.status}
                mastery={lesson.mastery}
                animate={false}
              />
              <span
                className={cn(
                  "flex-1 truncate",
                  lesson.status === "locked" && "text-muted-foreground",
                )}
              >
                {lesson.title}
              </span>
              {isSlipped && (
                <span className="text-muted-foreground text-xs">Review</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {slipped
            ? "Missed it, so it moves up the path."
            : "Mastered earlier, but practice can change that."}
        </p>
        <Button size="sm" variant="secondary" onClick={toggle}>
          {slipped ? "Reset" : "Miss a question"}
        </Button>
      </div>
    </div>
  );
}
