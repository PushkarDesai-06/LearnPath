/**
 * Presentational pieces shared by the tutor's server page, its loading state,
 * and the client chat island. No directive: safe in both environments.
 */
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shell/PageHeader";
import { cn } from "@/lib/utils";

export const TUTOR_FRAME = "flex h-svh min-h-0 flex-col";

const SKELETON_TURNS = [
  { role: "user", lines: ["w-36"] },
  { role: "assistant", lines: ["w-full", "w-11/12", "w-2/3"] },
  { role: "user", lines: ["w-52"] },
  { role: "assistant", lines: ["w-full", "w-3/4"] },
] as const;

/** Layout-matched loading state for a thread transcript. */
export function TranscriptSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-label="Loading thread"
    >
      {SKELETON_TURNS.map((turn, i) =>
        turn.role === "user" ? (
          <div key={i} className="flex justify-end">
            <div className="flex max-w-[85%] flex-col gap-2 rounded-xl rounded-tr-sm bg-surface-2 px-3 py-2.5">
              {turn.lines.map((w, j) => (
                <Skeleton key={j} className={cn("h-3", w)} />
              ))}
            </div>
          </div>
        ) : (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-5 shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
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

/** Whole-page loading state: header, rail and transcript. */
export function TutorSkeleton() {
  return (
    <div className={TUTOR_FRAME}>
      <PageHeader breadcrumbs={[{ label: "Tutor" }]} />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border p-2 md:flex">
          <Skeleton className="mb-2 h-7 w-full rounded-lg" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full rounded-md" />
          ))}
        </aside>
        <div className="mx-auto w-full max-w-2xl min-w-0 flex-1 px-4 py-6">
          <TranscriptSkeleton />
        </div>
      </div>
    </div>
  );
}
