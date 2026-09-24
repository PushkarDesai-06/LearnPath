import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUserOrRedirect } from "@/lib/auth/current";
import { readLessonView } from "@/lib/data/lesson";
import type { LessonDTO } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { LoadingRing } from "@/components/ui/loading-ring";
import { Markdown } from "@/components/Markdown";
import { ActiveTopicMarker } from "@/components/ActiveTopic";
import { PracticeBlock } from "./PracticeBlock";
import { LessonFooter } from "./LessonFooter";
import { LessonPoller } from "./LessonPoller";

const BLOCK_LABELS: Record<string, string> = {
  analogy: "Analogy",
  example: "Example",
};

/** The lesson isn't written yet — it keeps building in the background. */
function LessonGenerating({ curriculumId }: { curriculumId: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <LoadingRing className="size-7" />
      <div className="flex flex-col gap-1.5">
        <p className="text-foreground text-sm">Writing your lesson…</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          This one hasn&apos;t been generated yet. It keeps building in the
          background — stay here and it will appear on its own, or come back
          later.
        </p>
      </div>
      <Button variant="secondary" size="sm" asChild>
        <Link href={`/dashboard?id=${curriculumId}`}>
          <ArrowLeft data-icon="inline-start" />
          Back to path
        </Link>
      </Button>
    </div>
  );
}

/** A written lesson: server-rendered prose, with practice + completion islands. */
function LessonArticle({ lesson }: { lesson: LessonDTO }) {
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6">
      <Button variant="ghost" size="sm" asChild className="self-start -ml-2">
        <Link href={`/dashboard?id=${lesson.curriculumId}`}>
          <ArrowLeft data-icon="inline-start" />
          Back to path
        </Link>
      </Button>
      <header className="flex flex-col gap-2">
        <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
          Lesson
        </p>
        <h1 className="h-display text-3xl sm:text-4xl">{lesson.title}</h1>
      </header>

      {lesson.blocks.map((b, i) => {
        if (b.kind === "practice")
          return (
            <PracticeBlock
              key={b.questionId ?? i}
              block={b}
              lessonId={lesson.id}
            />
          );
        if (b.kind === "code")
          return (
            <div key={i} className="flex flex-col gap-1">
              {b.caption && (
                <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.14em]">
                  {b.caption}
                </p>
              )}
              <pre className="bg-surface-1 border-border/60 overflow-x-auto rounded-xl border p-4 font-mono text-xs leading-relaxed">
                <code>{b.code}</code>
              </pre>
            </div>
          );
        const label = BLOCK_LABELS[b.kind];
        return (
          <section key={i} className="flex flex-col gap-2">
            {label && (
              <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
                {label}
              </p>
            )}
            <div className="prose prose-invert prose-sm max-w-none prose-p:my-2">
              <Markdown>{b.markdown ?? ""}</Markdown>
            </div>
          </section>
        );
      })}

      <LessonFooter curriculumId={lesson.curriculumId} lessonRef={lesson.id} />
    </article>
  );
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const user = await requireUserOrRedirect();
  // Pure read — never enqueues (see LessonPoller for where that happens).
  const view = await readLessonView(user._id.toHexString(), lessonId);
  if (!view) notFound();

  // The URL names only the lesson, so tell the topbar which topic we're in —
  // both branches know it, written or not.
  const curriculumId =
    view.status === "ready" ? view.lesson.curriculumId : view.curriculumId;

  return (
    <>
      <ActiveTopicMarker curriculumId={curriculumId} />
      {view.status === "ready" ? (
        <LessonArticle lesson={view.lesson} />
      ) : (
        <LessonPoller lessonId={lessonId}>
          <LessonGenerating curriculumId={view.curriculumId} />
        </LessonPoller>
      )}
    </>
  );
}
