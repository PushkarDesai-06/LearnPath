/**
 * Where a learner is in creating a topic: describe it, take the diagnostic,
 * get the path. Shown on the onboarding and assessment pages so the three
 * screens read as one flow.
 */
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Describe", "Diagnose", "Build path"] as const;

export function SetupSteps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol aria-label="Topic setup" className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-3">
            {i > 0 && <span aria-hidden className="bg-border h-px w-6" />}
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em]",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-4 items-center justify-center rounded-full border text-[9px] tabular-nums",
                  active && "border-foreground",
                  done && "border-transparent bg-tone-mastered/15",
                )}
              >
                {done ? <Check className="size-2.5" /> : i + 1}
              </span>
              {label}
              {done && <span className="sr-only">(done)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
