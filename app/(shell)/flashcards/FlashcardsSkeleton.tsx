/** Layout-matched loading state for the review page. */
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader } from "@/components/shell/PageHeader";

export function FlashcardsSkeleton() {
  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Review" }]} />
      <PageContainer width="reading">
        <div className="flex w-full flex-col gap-8">
          <header className="flex flex-col gap-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-3 w-56" />
          </header>
          <Skeleton className="h-1 w-full" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </PageContainer>
    </>
  );
}
