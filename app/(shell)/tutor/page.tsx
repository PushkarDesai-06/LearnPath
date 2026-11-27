import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUserOrRedirect } from "@/lib/auth/current";
import { getConversation, listConversations } from "@/lib/data/tutor";
import { getShellData } from "@/lib/data/shell";
import { type Crumb } from "@/components/shell/PageHeader";
import { findLessonContext } from "@/components/shell/shellLookup";
import { TutorChat } from "./TutorChat";
import { TutorSkeleton } from "./TutorParts";

/** Threads + the newest thread's transcript, read on the server. */
async function TutorContent({
  userId,
  topicId,
  lessonId,
}: {
  userId: string;
  topicId: string | null;
  lessonId: string | null;
}) {
  const list = await listConversations(userId, topicId);
  if (!list) notFound();
  const first = list.conversations[0];
  const [initial, shell] = await Promise.all([
    first ? getConversation(userId, first.id) : null,
    getShellData(userId),
  ]);
  const topic = shell.topics.find((t) => t.id === list.curriculumId);
  const lessonContext =
    lessonId && topic ? findLessonContext([topic], lessonId) : null;
  const lesson = lessonContext
    ? { id: lessonId as string, title: lessonContext.lessonTitle }
    : null;
  const breadcrumbs: Crumb[] = topic
    ? [
        { label: topic.title, href: `/dashboard?id=${topic.id}` },
        { label: "Tutor" },
      ]
    : [{ label: "Tutor" }];

  return (
    <TutorChat
      breadcrumbs={breadcrumbs}
      curriculumId={list.curriculumId}
      lesson={lesson}
      initialConversations={list.conversations}
      initialActiveId={initial?.conversationId ?? null}
      initialMessages={initial?.messages ?? []}
    />
  );
}

export default async function TutorPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[]; lesson?: string | string[] }>;
}) {
  const { id, lesson } = await searchParams;
  const topicId = typeof id === "string" ? id : null;
  const lessonId = typeof lesson === "string" ? lesson : null;
  const user = await requireUserOrRedirect();

  // Keyed on the topic so a switch drops the old topic's threads at once.
  return (
    <Suspense key={`${topicId ?? ""}:${lessonId ?? ""}`} fallback={<TutorSkeleton />}>
      <TutorContent
        userId={user._id.toHexString()}
        topicId={topicId}
        lessonId={lessonId}
      />
    </Suspense>
  );
}
