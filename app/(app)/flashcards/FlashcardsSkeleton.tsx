/** Layout-matched loading state for the review page. */
import { Skeleton } from "@/components/ui/skeleton";

export function FlashcardsSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-2/3" />
      </header>
      <section className="border-border grid grid-cols-3 gap-x-6 border-y py-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-6 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </section>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
