/**
 * Layout-matched loading state — hero row + a grid of topic-card placeholders.
 *
 * Lives in its own module so `loading.tsx` can render it without pulling in the
 * topics page's client bundle.
 */
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TopicsSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-8 w-28 rounded-lg" />
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-40" />
                </div>
                <Skeleton className="h-4 w-8" />
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-end gap-3">
              <Skeleton className="h-1.5 w-full rounded-full" />
              <Skeleton className="h-3 w-3/4" />
            </CardContent>
            <CardFooter className="flex justify-between gap-1">
              <Skeleton className="h-7 w-14 rounded-lg" />
              <Skeleton className="h-7 w-24 rounded-lg" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
