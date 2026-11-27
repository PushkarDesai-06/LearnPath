import Link from "next/link";
import { Download, Layers } from "lucide-react";
import { getFlashcardsPage } from "@/lib/data/flashcards";
import { formatInterval } from "@/lib/domain/flashcards";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader } from "@/components/shell/PageHeader";
import { ReviewSession } from "./ReviewSession";

/** "in 3d" from now; the page is rendered per request, so the clock is fine here. */
function dueIn(iso: string): string {
  return `in ${formatInterval(Date.parse(iso) - Date.now())}`;
}

/**
 * A topic's flashcards, rendered on the server: counts, today's review
 * session, and which lessons the cards came from. Streams in behind the page's
 * keyed <Suspense>.
 */
export async function FlashcardsContent({
  userId,
  curriculumId,
}: {
  userId: string;
  curriculumId: string | null;
}) {
  const data = await getFlashcardsPage(userId, curriculumId);

  if (!data.hasCurriculum)
    return (
      <>
        <PageHeader breadcrumbs={[{ label: "Review" }]} />
        <PageContainer width="reading">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nothing here yet</EmptyTitle>
              <EmptyDescription>
                This topic doesn&apos;t have a learning path yet.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/topics">Go to topics</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </PageContainer>
      </>
    );

  const pathHref = `/dashboard?id=${data.curriculumId}`;
  const newCount = data.due.filter(
    (c) => c.schedule.reps === 0 && c.schedule.lapses === 0,
  ).length;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: data.title, href: pathHref },
          { label: "Review" },
        ]}
        actions={
          data.totalCount > 0 ? (
            <>
              <p className="mr-1 flex items-center gap-2 text-[12px] tabular-nums text-muted-foreground max-sm:hidden">
                <span>
                  <span className="text-foreground">{data.dueCount}</span> due
                </span>
                <span aria-hidden className="size-0.5 rounded-full bg-faint" />
                <span>
                  <span className="text-foreground">{newCount}</span> new
                </span>
              </p>
              <Button variant="secondary" size="sm" asChild>
              {/* A file download, not a page: a plain link, never prefetched. */}
              <a
                href={`/api/flashcards/export?id=${data.curriculumId}`}
                download
              >
                <Download data-icon="inline-start" />
                <span className="hidden sm:inline">Export to Anki</span>
                <span className="sm:hidden">Anki</span>
              </a>
              </Button>
            </>
          ) : undefined
        }
      />
      <PageContainer width="reading">
        <div className="flex w-full flex-col gap-8">
          <header className="flex flex-col gap-2">
            <h1 className="min-w-0 text-xl font-semibold tracking-tight [overflow-wrap:anywhere]">
              {data.title}
            </h1>
            <p className="flex flex-wrap items-center gap-x-3 text-[12.5px] text-muted-foreground">
              <span>
                <span className="tabular-nums text-foreground">
                  {data.dueCount}
                </span>{" "}
                due now
              </span>
              <span>
                <span className="tabular-nums text-foreground">
                  {data.totalCount}
                </span>{" "}
                cards
              </span>
              <span>
                <span className="tabular-nums text-foreground">
                  {data.lessons.length}
                </span>{" "}
                lessons
              </span>
            </p>
          </header>

          {data.totalCount === 0 ? (
            <Empty className="border border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Layers />
                </EmptyMedia>
                <EmptyTitle>No flashcards yet</EmptyTitle>
                <EmptyDescription>
                  At the end of any lesson, choose{" "}
                  <strong>Make flashcards</strong>. The cards show up here, and
                  come back for review just before you&apos;d forget them.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild variant="secondary">
                  <Link href={pathHref}>Go to your path</Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <ReviewSession
              curriculumId={data.curriculumId}
              initialCards={data.due}
              initialNextDueAt={data.nextDueAt}
              caughtUpNote={
                data.nextDueAt
                  ? `The next card is due ${dueIn(data.nextDueAt)}.`
                  : "Nothing is scheduled."
              }
            />
          )}

          {data.lessons.length > 0 && (
            <section className="flex flex-col gap-1">
              <h2 className="px-2 pb-1 text-[11.5px] font-medium text-faint">
                By lesson
              </h2>
              <ul className="flex flex-col">
                {data.lessons.map((l) => (
                  <li key={l.lessonRef}>
                    <Link
                      href={`/learn/${l.lessonRef}`}
                      className="flex min-h-9 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-[13px] transition-colors duration-(--dur-fast) hover:bg-hover"
                    >
                      <span className="min-w-0 [overflow-wrap:anywhere]">
                        {l.lessonTitle}
                      </span>
                      <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                        {l.cardCount} card{l.cardCount === 1 ? "" : "s"}
                        {l.dueCount > 0 && (
                          <span className="font-medium text-foreground">
                            {" "}
                            {l.dueCount} due
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </PageContainer>
    </>
  );
}
