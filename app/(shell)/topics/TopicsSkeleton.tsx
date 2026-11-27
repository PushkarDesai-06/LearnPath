/**
 * Layout-matched loading state: tab row plus a list of topic row placeholders.
 *
 * Lives in its own module so `loading.tsx` can render it without pulling in the
 * topics page's client bundle.
 */
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader } from "@/components/shell/PageHeader";

export function TopicsSkeleton() {
  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Topics" }]} />
      <PageContainer>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-[30px] w-44 rounded-lg" />
            <Skeleton className="h-7 w-16 rounded-lg" />
          </div>
          <div className="flex flex-col gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex h-11 items-center gap-3 px-2.5">
                <Skeleton className="size-5 rounded-full" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="ml-auto h-3 w-20" />
              </div>
            ))}
          </div>
        </div>
      </PageContainer>
    </>
  );
}
