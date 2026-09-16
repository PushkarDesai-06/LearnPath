"use client";

import { cn } from "@/lib/utils";
import { statusTone, type StatusTone } from "@/lib/format";

/**
 * TrailRail — the dashboard's module navigator.
 *
 * A vertical hairline with a small dot at each module marker, sized to match
 * the dashboard skeleton so nothing shifts when real data lands. It encodes:
 *   - sequence (top-to-bottom = curriculum order)
 *   - status  (dot variant by tone)
 *   - position (active row goes solid foreground)
 *
 * Clicks scroll the page to the module anchor (`#mod-<id>` on the module Card).
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

// Flat dots — no glows, no offsets. `bg-background` on the hollow variants
// masks the hairline running behind them.
const DOT_BY_TONE: Record<StatusTone, string> = {
  mastered: "bg-tone-mastered",
  progress: "bg-background border border-tone-progress",
  review: "bg-tone-review",
  locked: "bg-background border border-tone-locked/50",
  generating: "bg-tone-generating/50 animate-pulse",
  neutral: "bg-muted",
};

export function TrailRail({ items, activeId, className }: Props) {
  if (!items.length) return null;

  return (
    <nav
      aria-label="Learning path"
      className={cn(
        "relative hidden flex-col lg:flex",
        // Sticky rail on desktop; sits in its own column in the dashboard grid.
        "sticky top-20 self-start",
        className,
      )}
    >
      {/* Hairline through the dot centers — first/last row half-heights inset */}
      <div
        aria-hidden
        className="bg-border absolute top-3 bottom-3 left-[4.5px] w-px"
      />
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const tone = statusTone(item.status);
          const isActive = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={`#mod-${item.id}`}
                title={item.title}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "flex h-6 items-center gap-2.5 pr-2",
                  "transition-colors hover:text-foreground",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "relative size-2.5 shrink-0 rounded-full",
                    DOT_BY_TONE[tone],
                  )}
                />
                <span
                  className={cn(
                    "truncate text-xs leading-none",
                    isActive && "font-medium",
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
