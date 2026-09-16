"use client";

import { useEffect, useState } from "react";
import { Check, RotateCcw, Lock, Dot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The landing page's centerpiece: the adaptive path, moving.
 *
 * Describing "the curriculum reorders itself as your mastery shifts" in a
 * paragraph is forgettable; watching a lesson flip to needs-review and climb
 * back up the list is not. Each stage mirrors a real transition from
 * `lib/domain/adapt.ts` + `mastery.ts` — seeded mastery skips a lesson, EWMA
 * promotes one, a weak answer demotes another and hoists it.
 *
 * Rows are absolutely positioned and moved by `translateY`, so a reorder
 * animates instead of snapping. Pure CSS/state — no animation library.
 */

const ROW_PX = 56;

type Status = "mastered" | "progress" | "review" | "locked" | "available";

interface Stage {
  /** Lesson ids, top to bottom. */
  order: string[];
  status: Record<string, Status>;
  label: string;
  caption: string;
}

const LESSONS: Record<string, string> = {
  io: "Reading CSVs with pandas",
  idx: "Indexing and selection",
  grp: "GroupBy aggregations",
  join: "Merging and joins",
  ts: "Time series resampling",
};

const STAGES: Stage[] = [
  {
    label: "After the quiz",
    order: ["io", "idx", "grp", "join", "ts"],
    status: {
      io: "mastered",
      idx: "available",
      grp: "locked",
      join: "locked",
      ts: "locked",
    },
    caption:
      "Your intake quiz already showed you can load a file. That lesson starts mastered — and gets skipped.",
  },
  {
    label: "You practice",
    order: ["io", "idx", "grp", "join", "ts"],
    status: {
      io: "mastered",
      idx: "mastered",
      grp: "progress",
      join: "locked",
      ts: "locked",
    },
    caption:
      "Mastery is a rolling average over every practice answer — not a checkbox you tick.",
  },
  {
    label: "A shaky answer",
    order: ["io", "idx", "grp", "join", "ts"],
    status: {
      io: "mastered",
      idx: "mastered",
      grp: "review",
      join: "available",
      ts: "locked",
    },
    caption:
      "Two weak answers on group-bys drop that score below the review threshold.",
  },
  {
    label: "The path rewrites",
    order: ["grp", "join", "ts", "io", "idx"],
    status: {
      grp: "review",
      join: "available",
      ts: "available",
      io: "mastered",
      idx: "mastered",
    },
    caption:
      "So the weak lesson is hoisted back to the front, prerequisites still respected, and mastered work sinks.",
  },
];

const STATUS_LABEL: Record<Status, string> = {
  mastered: "Mastered",
  progress: "In progress",
  review: "Needs review",
  locked: "Locked",
  available: "Up next",
};

function StatusIcon({ status }: { status: Status }) {
  if (status === "mastered") return <Check className="size-3.5" />;
  if (status === "review") return <RotateCcw className="size-3.5" />;
  if (status === "locked") return <Lock className="size-3.5" />;
  return <Dot className="size-3.5" />;
}

export function AdaptivePathDemo() {
  const [stage, setStage] = useState(0);
  const [auto, setAuto] = useState(true);
  const current = STAGES[stage];

  useEffect(() => {
    if (!auto) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setStage((s) => (s + 1) % STAGES.length), 3400);
    return () => clearInterval(t);
  }, [auto]);

  function pick(i: number) {
    setAuto(false); // a deliberate click wins over the carousel
    setStage(i);
  }

  return (
    <div className="bg-surface-1/60 border-border/60 relative overflow-hidden rounded-2xl border backdrop-blur-sm">
      {/* Window chrome — frames it as a product surface, not a diagram. */}
      <div className="border-border/60 flex items-center gap-2 border-b px-4 py-2.5">
        <span className="text-muted-foreground/70 font-mono text-[10px] uppercase tracking-[0.16em]">
          Your path
        </span>
        <span className="text-muted-foreground/40 font-mono text-[10px]">
          / Python for data analysis
        </span>
      </div>

      <div className="p-4 sm:p-6">
        <div
          className="relative"
          style={{ height: STAGES[0].order.length * ROW_PX }}
        >
          {Object.entries(LESSONS).map(([id, title]) => {
            const pos = current.order.indexOf(id);
            const status = current.status[id];
            const dim = status === "locked";
            return (
              <div
                key={id}
                className={cn(
                  "border-border/50 bg-surface-1 absolute inset-x-0 flex h-12 items-center gap-3 rounded-xl border px-3",
                  "transition-[transform,opacity,border-color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  dim && "opacity-45",
                  status === "review" && "border-tone-review/40",
                  status === "mastered" && "border-tone-mastered/25",
                )}
                style={{ transform: `translateY(${pos * ROW_PX}px)` }}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full",
                    status === "mastered" &&
                      "bg-tone-mastered/15 text-tone-mastered",
                    status === "review" && "bg-tone-review/15 text-tone-review",
                    status === "progress" &&
                      "bg-tone-progress/15 text-tone-progress",
                    (status === "locked" || status === "available") &&
                      "bg-muted text-muted-foreground",
                  )}
                >
                  <StatusIcon status={status} />
                </span>
                <span
                  className={cn(
                    "flex-1 truncate text-sm",
                    status === "mastered" && "text-muted-foreground",
                  )}
                >
                  {title}
                </span>
                <Badge
                  variant="status"
                  tone={status === "available" ? "generating" : status}
                  className="hidden shrink-0 sm:inline-flex"
                >
                  {STATUS_LABEL[status]}
                </Badge>
              </div>
            );
          })}
        </div>

        {/* Stage caption + scrubber */}
        <div className="border-border/60 mt-5 flex flex-col gap-3 border-t pt-4">
          <div className="flex items-baseline gap-3">
            <span className="text-muted-foreground/70 font-mono text-[10px] uppercase tracking-[0.16em]">
              {String(stage + 1).padStart(2, "0")}
            </span>
            <span className="text-sm font-medium">{current.label}</span>
          </div>
          <p
            key={stage} // re-key so the caption fades on every change
            className="text-muted-foreground animate-in fade-in-0 min-h-[2.5rem] text-sm leading-relaxed duration-500"
          >
            {current.caption}
          </p>
          <div className="flex gap-1.5" role="tablist" aria-label="Path stages">
            {STAGES.map((s, i) => (
              <button
                key={s.label}
                role="tab"
                aria-selected={i === stage}
                aria-label={s.label}
                onClick={() => pick(i)}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-300",
                  i === stage ? "bg-primary/70" : "bg-border hover:bg-border/80",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
