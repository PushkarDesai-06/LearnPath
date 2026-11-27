"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { label: 'sales["region"].sum()', level: 0.26 },
  { label: 'sales.groupby("region").sum()', level: 0.68 },
  { label: 'sales.sort_values("region")', level: 0.26 },
  { label: "I don't know", level: 0.3 },
] as const;
const CORRECT = 1;
const START_LEVEL = 0.4;

function bandFor(level: number) {
  if (level < 0.35) return "Beginner";
  if (level < 0.6) return "Intermediate";
  return "Advanced";
}

export function QuizDemo() {
  const [picked, setPicked] = useState<number | null>(null);
  const level = picked === null ? START_LEVEL : OPTIONS[picked].level;

  return (
    <div className="bg-surface-2 border-border flex flex-col gap-3 rounded-xl border p-3.5">
      <p className="text-[13px] font-medium">
        Which call returns one row per region?
      </p>
      <div role="group" aria-label="Answers" className="flex flex-col gap-1.5">
        {OPTIONS.map((option, index) => {
          const isPicked = picked === index;
          return (
            <button
              key={option.label}
              type="button"
              disabled={picked !== null}
              aria-pressed={isPicked}
              onClick={() => setPicked(index)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-mono text-xs transition-[background-color,color] duration-(--dur-fast) outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
                "bg-surface-1 shadow-[inset_0_0_0_1px_var(--border-strong)] enabled:hover:bg-hover",
                isPicked && "bg-active font-medium",
                picked !== null && !isPicked && "text-muted-foreground",
              )}
            >
              <span className="flex size-3.5 shrink-0 items-center justify-center">
                {picked !== null && index === CORRECT && (
                  <Check className="size-3.5" aria-label="Correct answer" />
                )}
              </span>
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5" aria-live="polite">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">Level estimate</span>
          <span className="font-medium">
            {picked === null ? "Starting point" : bandFor(level)}
          </span>
        </div>
        <div
          aria-hidden
          className="bg-surface-3 h-1.5 overflow-hidden rounded-full"
        >
          <div
            className="bg-foreground h-full origin-left rounded-full transition-transform duration-500 ease-(--ease-out) motion-reduce:transition-none"
            style={{ transform: `scaleX(${level})` }}
          />
        </div>
      </div>

      <div className="flex h-[26px] items-center justify-between">
        <span className="text-muted-foreground text-xs">
          {picked === null
            ? "Pick an answer to move the estimate."
            : picked === CORRECT
              ? "Correct, the estimate moves up."
              : "Not quite, the estimate moves down."}
        </span>
        {picked !== null && (
          <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
