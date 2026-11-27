/**
 * Layout-matched loading state: sub nav on the left, profile rows on the right.
 *
 * Lives in its own module so `loading.tsx` can render it without pulling in the
 * account page's client bundle.
 */
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader } from "@/components/shell/PageHeader";

export function AccountSkeleton() {
  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Account" }]} />
      <PageContainer>
        <div className="grid gap-6 md:grid-cols-[160px_minmax(0,1fr)] md:gap-12">
          <div className="flex gap-1 md:flex-col">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-md md:w-full" />
            ))}
          </div>
          <div className="flex max-w-[680px] flex-col gap-4">
            <Skeleton className="h-5 w-24" />
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-6 w-40" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex h-10 items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        </div>
      </PageContainer>
    </>
  );
}
