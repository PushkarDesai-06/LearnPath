import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { requireUserOrRedirect } from "@/lib/auth/current";
import { readLessonView } from "@/lib/data/lesson";
import type { LessonBlockDTO, LessonDTO, ShellTopic } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusIcon } from "@/components/StatusIcon";
import { Markdown } from "@/components/Markdown";
import { ActiveTopicMarker } from "@/components/ActiveTopic";
import { getShellData } from "@/lib/data/shell";
import { FocusToggle } from "@/components/shell/FocusToggle";
import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader, type Crumb } from "@/components/shell/PageHeader";
import { findLessonContext } from "@/components/shell/shellLookup";
import { RecordRecent } from "./RecordRecent";
import { PracticeBlock } from "./PracticeBlock";
import { BlockLabel } from "./BlockLabel";
import { CodeBlock } from "./CodeBlock";
import {
  LessonControlsProvider,
  LessonHeaderActions,
  LessonMenu,
  type LessonNeighbor,
} from "./LessonControls";
import { ReadingProgress } from "./ReadingProgress";
import { InteractiveBlock } from "./InteractiveBlock";
import { BlockVariants } from "./BlockVariants";
import { LessonFooter } from "./LessonFooter";
import { LessonFlashcards } from "./LessonFlashcards";
import { LessonPoller } from "./LessonPoller";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** The lesson isn't written yet. It keeps building in the background. */
function LessonGenerating({ curriculumId }: { curriculumId: string }) {
  return (
    <div className="mx-auto flex w-full flex-col gap-10 py-10">
      <div
        role="status"
        className="animate-in fade-in-0 flex flex-col items-center gap-4 text-center duration-300"
      >
        <StatusIcon status="generating" size={28} />
        <div className="flex flex-col gap-1.5">
          <p className="text-foreground text-base font-medium">
            Writing your lesson
          </p>
          <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
            Drafting the explanation, then the examples and practice questions.
            It keeps building in the background, so stay here and it will
            appear on its own, or come back later.
          </p>
        </div>
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/dashboard?id=${curriculumId}`}>
            <ArrowLeft data-icon="inline-start" />
            Back to path
          </Link>
        </Button>
      </div>
      <div aria-hidden className="flex flex-col gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProseBlock({ block }: { block: LessonBlockDTO }) {
  return (
    <section className="flex flex-col gap-2">
      <BlockLabel kind={block.kind} />
      <Markdown>{block.markdown ?? ""}</Markdown>
    </section>
  );
}

/**
 * A written lesson: server-rendered prose, with practice, interactive-demo,
 * "explain differently", flashcard and completion islands.
 */
function LessonArticle({
  lesson,
  next,
}: {
  lesson: LessonDTO;
  next: LessonNeighbor | null;
}) {
  return (
    <article className="flex w-full flex-col gap-7">
      <header className="flex flex-col gap-2">
        <BlockLabel label="Lesson" Icon={GraduationCap} />
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
        if (b.kind === "interactive")
          return (
            <InteractiveBlock
              key={b.blockId ?? i}
              block={b}
              lessonId={lesson.id}
            />
          );
        const content =
          b.kind === "code" ? (
            <CodeBlock block={b} />
          ) : (
            <ProseBlock block={b} />
          );
        if (!b.blockKey) return <div key={i}>{content}</div>;
        return (
          <BlockVariants
            key={b.blockKey}
            lessonId={lesson.id}
            blockKey={b.blockKey}
            kind={b.kind}
            initial={b.variants ?? []}
          >
            {content}
          </BlockVariants>
        );
      })}

      <LessonFlashcards
        lessonId={lesson.id}
        curriculumId={lesson.curriculumId}
        initial={lesson.flashcards ?? { made: false, cardCount: 0 }}
      />

      <LessonFooter
        curriculumId={lesson.curriculumId}
        lessonRef={lesson.id}
        next={next}
      />
    </article>
  );
}

function neighborsOf(
  topic: ShellTopic,
  lessonId: string,
): { previous: LessonNeighbor | null; next: LessonNeighbor | null } {
  const flat = topic.modules.flatMap((module) =>
    module.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      locked: module.status === "locked" || lesson.status === "locked",
    })),
  );
  const index = flat.findIndex((lesson) => lesson.id === lessonId);
  return {
    previous: index > 0 ? flat[index - 1] : null,
    next: index >= 0 && index < flat.length - 1 ? flat[index + 1] : null,
  };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const user = await requireUserOrRedirect();
  // Pure read, never enqueues (see LessonPoller for where that happens).
  const view = await readLessonView(user._id.toHexString(), lessonId);
  if (!view) notFound();

  // The URL names only the lesson, so tell the sidebar which topic we're in:
  // every branch knows it, written or not.
  const curriculumId =
    view.status === "ready" ? view.lesson.curriculumId : view.curriculumId;

  const shell = await getShellData(user._id.toHexString());
  const context = findLessonContext(shell.topics, lessonId);
  const breadcrumbs: Crumb[] = context
    ? [
        {
          label: context.topic.title,
          href: `/dashboard?id=${context.topic.id}`,
        },
        {
          label: context.module.title,
          href: `/dashboard?id=${context.topic.id}#mod-${context.module.id}`,
        },
        { label: context.lessonTitle },
      ]
    : [{ label: "Lesson" }];

  const neighbors = context ? neighborsOf(context.topic, lessonId) : null;
  const lessonLink = context?.module.lessons.find((l) => l.id === lessonId);

  const body = (
    <PageContainer width="reading">
      {view.status === "locked" ? (
        <div className="mx-auto flex max-w-md flex-col items-start gap-4 py-12">
          <Alert>
            <AlertTitle>This module is locked</AlertTitle>
            <AlertDescription>
              Complete earlier modules on your path to unlock this lesson.
            </AlertDescription>
          </Alert>
          <Button asChild variant="secondary">
            <Link href={`/dashboard?id=${curriculumId}`}>Back to path</Link>
          </Button>
        </div>
      ) : view.status === "ready" ? (
        <LessonArticle lesson={view.lesson} next={neighbors?.next ?? null} />
      ) : (
        <LessonPoller lessonId={lessonId}>
          <LessonGenerating curriculumId={view.curriculumId} />
        </LessonPoller>
      )}
    </PageContainer>
  );

  return (
    <>
      <ActiveTopicMarker curriculumId={curriculumId} />
      {view.status !== "locked" && (
        <RecordRecent curriculumId={curriculumId} lessonId={lessonId} />
      )}
      {context && neighbors && view.status !== "locked" ? (
        <LessonControlsProvider
          key={lessonId}
          curriculumId={curriculumId}
          lessonId={lessonId}
          title={context.lessonTitle}
          masteryScore={lessonLink?.masteryScore ?? 0}
          initialPinned={shell.pins.some((pin) => pin.lessonId === lessonId)}
        >
          <PageHeader
            breadcrumbs={breadcrumbs}
            actions={
              <LessonHeaderActions
                previous={neighbors.previous}
                next={neighbors.next}
              />
            }
            menu={<LessonMenu />}
          />
          {view.status === "ready" && <ReadingProgress />}
          {body}
        </LessonControlsProvider>
      ) : (
        <>
          <PageHeader breadcrumbs={breadcrumbs} actions={<FocusToggle />} />
          {body}
        </>
      )}
    </>
  );
}
