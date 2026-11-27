import { Suspense } from "react";
import Link from "next/link";
import { Layers, MessageSquare, Route } from "lucide-react";
import { getDashboard } from "@/lib/data/progress";
import { getShellData } from "@/lib/data/shell";
import { readTimeZone } from "@/lib/server/timezone";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader } from "@/components/shell/PageHeader";
import { Activity, ActivitySkeleton } from "./Activity";
import { ContinueCard } from "./ContinueCard";
import { DashboardProvider } from "./DashboardProvider";
import { LessonList } from "./LessonList";
import { StatsRow } from "./StatsRow";
import { ViewOptions } from "./ViewOptions";

/**
 * The topic hub, rendered on the server: continue card, stats, activity and the
 * grouped lesson list. Streams in behind the page's keyed <Suspense>.
 */
export async function DashboardContent({
  userId,
  curriculumId,
}: {
  userId: string;
  curriculumId: string | null;
}) {
  const [data, shell, timeZone] = await Promise.all([
    getDashboard(userId, curriculumId),
    getShellData(userId),
    readTimeZone(),
  ]);

  if (!data.hasCurriculum)
    return (
      <>
        <PageHeader breadcrumbs={[{ label: "Dashboard" }]} />
        <PageContainer>
          <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-16 text-center">
            <Route className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              This topic does not have a learning path yet.
            </p>
            <Button asChild>
              <Link href="/topics">Go to topics</Link>
            </Button>
          </div>
        </PageContainer>
      </>
    );

  const nextLesson = data.recommendedNext
    ? (data.modules
        .flatMap((module) => module.lessons)
        .find((lesson) => lesson.id === data.recommendedNext?.lessonId) ?? null)
    : null;
  const due = data.flashcards.due;
  const pinnedLessonIds = shell.pins
    .filter((pin) => pin.curriculumId === data.curriculumId)
    .map((pin) => pin.lessonId);

  return (
    <DashboardProvider
      curriculumId={data.curriculumId}
      initialPrefs={shell.prefs.dashboard}
      pinnedLessonIds={pinnedLessonIds}
      modules={data.modules}
    >
      <PageHeader
        breadcrumbs={[{ label: data.title }, { label: "Dashboard" }]}
        actions={
          <>
            <ViewOptions />
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/tutor?id=${data.curriculumId}`}>
                <MessageSquare data-icon="inline-start" />
                <span className="max-sm:sr-only">Tutor</span>
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/flashcards?id=${data.curriculumId}`}>
                <Layers data-icon="inline-start" />
                <span className="max-sm:sr-only">Review</span>
                {due > 0 && (
                  <span className="rounded-full bg-surface-3 px-1.5 text-[11px] leading-[16px] font-medium tabular-nums">
                    {due}
                    <span className="sr-only"> cards due</span>
                  </span>
                )}
              </Link>
            </Button>
          </>
        }
      />
      <PageContainer>
        <div className="flex flex-col gap-3">
          <ContinueCard
            next={data.recommendedNext}
            lesson={nextLesson}
            curriculumId={data.curriculumId}
            dueCards={due}
          />
          <StatsRow summary={data.summary} />
          <Suspense fallback={<ActivitySkeleton />}>
            <Activity userId={userId} curriculumId={data.curriculumId} />
          </Suspense>
          <div className="mt-3">
            <LessonList modules={data.modules} timeZone={timeZone} />
          </div>
        </div>
      </PageContainer>
    </DashboardProvider>
  );
}
