/**
 * Layout-matched loading state — mirrors the rail + hero + stats + module cards
 * so content doesn't jump when the real data arrives.
 *
 * Lives in its own module so `loading.tsx` can render it without pulling in the
 * dashboard's client bundle.
 */
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="absolute inset-y-0 right-full hidden w-44 pr-6 min-[1180px]:block">
        <div className="sticky top-20 flex flex-col gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex h-6 items-center gap-2.5">
              <Skeleton className="size-2.5 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-2/3" />
        </header>

        <section className="border-border grid grid-cols-2 gap-x-6 gap-y-5 border-y py-5 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <Skeleton className="h-3 w-16" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="mt-2 h-3 w-3/4" />
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div
                    key={j}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}
