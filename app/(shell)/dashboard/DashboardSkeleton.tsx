/**
 * Layout-matched loading state: continue card, stats, activity and the grouped
 * list, row for row, so content does not jump when the real data arrives.
 *
 * Lives in its own module so `loading.tsx` can render it without pulling in the
 * dashboard's client bundle.
 */
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader } from "@/components/shell/PageHeader";
import { ActivitySkeleton } from "./Activity";

const FRAME = "rounded-[10px] bg-surface-1 shadow-[inset_0_0_0_1px_var(--border)]";

export function DashboardSkeleton() {
  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Dashboard" }]} />
      <PageContainer>
        <div className="flex flex-col gap-3" aria-busy>
          <div className={`${FRAME} flex items-center gap-4 rounded-xl px-4 py-3.5`}>
            <Skeleton className="size-5 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-4 w-56 max-w-full" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-[30px] w-24" />
          </div>

          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className={`${FRAME} flex items-center gap-2.5 px-3.5 py-3`}>
                <Skeleton className="size-7 rounded-full" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>

          <ActivitySkeleton />

          <div className={`${FRAME} mt-3 overflow-hidden`}>
            {Array.from({ length: 3 }).map((_, group) => (
              <div key={group} className={group > 0 ? "border-t border-border" : ""}>
                <div className="flex h-[34px] items-center gap-2 bg-surface-2 px-3">
                  <Skeleton className="size-3.5" />
                  <Skeleton className="size-3.5 rounded-full" />
                  <Skeleton className="h-3.5 w-40" />
                </div>
                {Array.from({ length: group === 0 ? 4 : 3 }).map((_, row) => (
                  <div
                    key={row}
                    className="flex h-9 items-center gap-2.5 border-t border-border pr-3 pl-8"
                  >
                    <Skeleton className="size-3.5 rounded-full" />
                    <Skeleton className="h-3.5 w-48 max-w-[50%]" />
                    <span className="flex-1" />
                    <Skeleton className="hidden h-3 w-16 sm:block" />
                    <Skeleton className="h-3 w-8" />
                    <Skeleton className="hidden h-1 w-11 sm:block" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </PageContainer>
    </>
  );
}
