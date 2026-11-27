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

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: data.title, href: pathHref },
          { label: "Review" },
        ]}
        actions={
          data.totalCount > 0 ? (
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
          ) : undefined
        }
      />
      <PageContainer width="reading">
        <div className="flex w-full flex-col gap-8">
          <header className="flex flex-col gap-3">
            <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
              Flashcards
            </p>
            <h1 className="h-display min-w-0 text-3xl [overflow-wrap:anywhere] sm:text-4xl">
              {data.title}
            </h1>
          </header>

          <section className="border-border grid grid-cols-3 gap-x-6 border-y py-5">
            <Stat label="Due now" value={String(data.dueCount)} />
            <Stat label="Cards" value={String(data.totalCount)} />
            <Stat label="Lessons" value={String(data.lessons.length)} />
          </section>

          {data.totalCount === 0 ? (
            <Empty className="border-border/60 border">
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
            <section className="flex flex-col gap-3">
              <h2 className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
                By lesson
              </h2>
              <ul className="flex flex-col">
                {data.lessons.map((l) => (
                  <li
                    key={l.lessonRef}
                    className="border-border/40 flex items-center justify-between gap-3 border-b py-2.5 last:border-b-0"
                  >
                    <Link
                      href={`/learn/${l.lessonRef}`}
                      className="hover:text-primary min-w-0 text-sm [overflow-wrap:anywhere] transition-colors"
                    >
                      {l.lessonTitle}
                    </Link>
                    <span className="text-muted-foreground shrink-0 font-mono text-[10px] tabular-nums">
                      {l.cardCount} card{l.cardCount === 1 ? "" : "s"}
                      {l.dueCount > 0 && (
                        <span className="text-primary">
                          {" "}
                          · {l.dueCount} due
                        </span>
                      )}
                    </span>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-mono text-2xl font-normal tabular-nums">{value}</p>
      <p className="text-muted-foreground/80 font-mono text-[10px] uppercase tracking-[0.16em]">
        {label}
      </p>
    </div>
  );
}
