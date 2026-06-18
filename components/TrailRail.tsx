"use client";

import { cn } from "@/lib/utils";
import { statusTone, type StatusTone } from "@/lib/format";

/**
 * TrailRail — the dashboard's signature element.
 *
 * A vertical hairline with mint dots at each module marker. The path collapsed
 * into a clickable rail. It encodes three things at once:
 *   - sequence (top-to-bottom = curriculum order)
 *   - status  (dot variant by tone)
 *   - position (active marker pops a mint glow)
 *
 * Not decoration: this is a real navigator. Clicks scroll the page to the
 * module anchor (`#mod-<id>` on the module Card).
 */

export interface RailItem {
  id: string;
  title: string;
  status: string; // raw backend status — converted to a tone here
}

interface Props {
  items: RailItem[];
  activeId?: string | null;
  className?: string;
}

const DOT_BY_TONE: Record<StatusTone, string> = {
  mastered: "bg-tone-mastered shadow-[0_0_0_3px_var(--color-tone-mastered)]/15",
  progress:
    "bg-transparent border border-tone-progress shadow-[0_0_12px_var(--color-tone-progress)]/30",
  review: "bg-tone-review",
  locked: "bg-transparent border border-tone-locked/60",
  generating:
    "bg-tone-generating/40 border border-tone-generating animate-pulse",
  neutral: "bg-muted",
};

export function TrailRail({ items, activeId, className }: Props) {
  if (!items.length) return null;

  return (
    <nav
      aria-label="Learning path"
      className={cn(
        "relative hidden flex-col py-1 lg:flex",
        // Sticky rail on desktop; sits in its own column in the dashboard grid.
        "sticky top-20 self-start",
        className,
      )}
    >
      {/* The hairline runs through the center of the dots */}
      <div
        aria-hidden
        className="absolute top-2 bottom-2 left-[7px] w-px bg-border"
      />
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const tone = statusTone(item.status);
          const isActive = item.id === activeId;
          return (
            <li key={item.id} className="relative">
              <a
                href={`#mod-${item.id}`}
                className={cn(
                  "group flex items-start gap-3 rounded-md py-1 pl-0 pr-2",
                  "transition-colors hover:text-foreground",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 size-3.5 shrink-0 rounded-full transition-all",
                    DOT_BY_TONE[tone],
                    isActive &&
                      "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "text-xs leading-tight",
                    isActive ? "font-medium" : "font-normal",
                  )}
                >
                  {item.title}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
