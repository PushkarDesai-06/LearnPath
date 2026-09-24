/**
 * Presentational pieces shared by the tutor's server page, its loading state,
 * and the client chat island. No directive: safe in both environments.
 */
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Mint dot prefix for assistant turns — matches the logo + trail-rail mark. */
export function TutorDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-primary shadow-primary/40 mt-2 size-1.5 shrink-0 rounded-full shadow-[0_0_6px]",
        className,
      )}
    />
  );
}

export function TutorHeader() {
  return (
    <header className="flex flex-col gap-2">
      <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
        Socratic tutor
      </p>
      <h1 className="h-display text-3xl">Think it through.</h1>
      <p className="text-muted-foreground text-sm">
        I guide you toward answers. I won&apos;t hand them over.
      </p>
    </header>
  );
}

// Layout-matched loading state for a thread transcript — alternating user
// bubbles and assistant blocks, sized like the real turns they stand in for.
const SKELETON_TURNS = [
  { role: "user", lines: ["w-36"] },
  { role: "assistant", lines: ["w-full", "w-11/12", "w-2/3"] },
  { role: "user", lines: ["w-52"] },
  { role: "assistant", lines: ["w-full", "w-3/4"] },
] as const;

export function TranscriptSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-label="Loading thread"
    >
      {SKELETON_TURNS.map((turn, i) =>
        turn.role === "user" ? (
          <div key={i} className="flex flex-row-reverse gap-3">
            <div className="bg-surface-2/80 flex max-w-[85%] flex-col gap-2 rounded-xl rounded-tr-sm px-3.5 py-2.5">
              {turn.lines.map((w, j) => (
                <Skeleton key={j} className={cn("h-3", w)} />
              ))}
            </div>
          </div>
        ) : (
          <div key={i} className="flex gap-3">
            <Skeleton className="mt-2 size-1.5 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-md bg-white/10 p-3 px-4">
              {turn.lines.map((w, j) => (
                <Skeleton key={j} className={cn("h-3", w)} />
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

/** Whole-page loading state: rail + header + transcript. */
export function TutorSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-1">
        <Skeleton className="mb-2 h-8 w-full rounded-lg" />
        <Skeleton className="mb-1 h-3 w-16" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-lg" />
        ))}
      </aside>
      <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <TranscriptSkeleton />
      </div>
    </div>
  );
}
