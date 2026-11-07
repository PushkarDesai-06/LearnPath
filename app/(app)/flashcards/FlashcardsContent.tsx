import Link from "next/link";
import { Download, Layers } from "lucide-react";
import { getFlashcardsPage } from "@/lib/data/flashcards";
import { formatInterval } from "@/lib/domain/flashcards";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { NoTopicState } from "@/components/NoTopicState";
import { PageHeader } from "@/components/PageHeader";
import { StatRow } from "@/components/StatRow";
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
    return <NoTopicState userId={userId} requestedId={curriculumId} />;

  const pathHref = `/dashboard?id=${data.curriculumId}`;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <PageHeader
        eyebrow="Flashcards"
        title={data.title}
        actions={
          data.totalCount > 0 && (
            <Button variant="ghost" size="sm" asChild>
              {/* A file download, not a page: a plain link, never prefetched. */}
              <a href={`/api/flashcards/export?id=${data.curriculumId}`} download>
                <Download data-icon="inline-start" />
                Export to Anki
              </a>
            </Button>
          )
        }
      />

      <StatRow
        stats={[
          { label: "Due now", value: String(data.dueCount) },
          { label: "Cards", value: String(data.totalCount) },
          { label: "Lessons", value: String(data.lessons.length) },
        ]}
      />

      {data.totalCount === 0 ? (
        <EmptyState
          icon={Layers}
          title="No flashcards yet"
          description={
            <>
              At the end of any lesson, choose <strong>Make flashcards</strong>. The cards
              show up here, and come back for review just before you&apos;d forget them.
            </>
          }
          action={{ href: pathHref, label: "Go to your path", variant: "secondary" }}
        />
      ) : (
        <ReviewSession
          curriculumId={data.curriculumId}
          initialCards={data.due}
          initialNextDueAt={data.nextDueAt}
          caughtUpNote={
            data.nextDueAt ? `The next card is due ${dueIn(data.nextDueAt)}.` : "Nothing is scheduled."
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
                  {l.dueCount > 0 && <span className="text-primary"> · {l.dueCount} due</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
