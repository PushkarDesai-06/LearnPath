/**
 * Layout-matched loading state — mirrors the article layout (back link, header,
 * body sections, footer actions) so content doesn't jump when it arrives. It
 * deliberately doesn't claim the lesson is being written: at this point we
 * don't know yet whether it's already stored.
 *
 * Lives in its own module so `loading.tsx` can render it without pulling in the
 * lesson page's client bundle.
 */
import { Skeleton } from "@/components/ui/skeleton";

export function LessonSkeleton() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Skeleton className="h-8 w-28" />
      <header className="flex flex-col gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-3/4" />
      </header>
      {Array.from({ length: 3 }).map((_, i) => (
        <section key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </section>
      ))}
      <div className="border-border mt-4 flex items-center justify-between gap-3 border-t pt-6">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}
