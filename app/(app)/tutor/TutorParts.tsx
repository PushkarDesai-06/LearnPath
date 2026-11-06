/**
 * Presentational pieces shared by the tutor's server page, its loading state,
 * and the client chat island. No directive: safe in both environments.
 */
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Dot prefix for assistant turns, matching the logo and trail-rail mark. */
export function TutorDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("bg-primary mt-2 size-1.5 shrink-0 rounded-full", className)}
    />
  );
}

/** Tutor turns read as prose; the learner's turns are the filled bubbles. */
export const ASSISTANT_TURN = "min-w-0 flex-1 pt-0.5 text-sm";
export const USER_TURN =
  "bg-surface-2 max-w-[85%] rounded-xl rounded-tr-sm px-3.5 py-2 text-sm whitespace-pre-wrap";

const SKELETON_TURNS = [
  { role: "user", lines: ["w-36"] },
  { role: "assistant", lines: ["w-full", "w-11/12", "w-2/3"] },
  { role: "user", lines: ["w-52"] },
  { role: "assistant", lines: ["w-full", "w-3/4"] },
] as const;

export function TranscriptSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading thread">
      {SKELETON_TURNS.map((turn, i) =>
        turn.role === "user" ? (
          <div key={i} className="flex flex-row-reverse gap-3">
            <div className={cn(USER_TURN, "flex flex-col gap-2 py-2.5")}>
              {turn.lines.map((w, j) => (
                <Skeleton key={j} className={cn("h-3", w)} />
              ))}
            </div>
          </div>
        ) : (
          <div key={i} className="flex gap-3">
            <Skeleton className="mt-2 size-1.5 shrink-0 rounded-full" />
            <div className={cn(ASSISTANT_TURN, "flex flex-col gap-2")}>
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

/** Whole-page loading state: same centred column and gutter rail as the page. */
export function TutorSkeleton() {
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="absolute inset-y-0 right-full hidden w-52 pr-6 min-[1180px]:block">
        <div className="flex flex-col gap-1">
          <Skeleton className="mb-2 h-8 w-full rounded-lg" />
          <Skeleton className="mb-1 h-3 w-16" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <TranscriptSkeleton />
      </div>
    </div>
  );
}
