import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUserOrRedirect } from "@/lib/auth/current";
import { getConversation, listConversations } from "@/lib/data/tutor";
import { getShellData } from "@/lib/data/shell";
import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader, type Crumb } from "@/components/shell/PageHeader";
import { TutorChat } from "./TutorChat";
import { TutorSkeleton } from "./TutorParts";

/** Threads + the newest thread's transcript, read on the server. */
async function TutorContent({
  userId,
  topicId,
}: {
  userId: string;
  topicId: string | null;
}) {
  const list = await listConversations(userId, topicId);
  if (!list) notFound();
  const first = list.conversations[0];
  const [initial, shell] = await Promise.all([
    first ? getConversation(userId, first.id) : null,
    getShellData(userId),
  ]);
  const topic = shell.topics.find((t) => t.id === list.curriculumId);
  const breadcrumbs: Crumb[] = topic
    ? [
        { label: topic.title, href: `/dashboard?id=${topic.id}` },
        { label: "Tutor" },
      ]
    : [{ label: "Tutor" }];

  return (
    <>
      <PageHeader breadcrumbs={breadcrumbs} />
      <PageContainer>
        <TutorChat
          curriculumId={list.curriculumId}
          initialConversations={list.conversations}
          initialActiveId={initial?.conversationId ?? null}
          initialMessages={initial?.messages ?? []}
        />
      </PageContainer>
    </>
  );
}

export default async function TutorPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const { id } = await searchParams;
  const topicId = typeof id === "string" ? id : null;
  const user = await requireUserOrRedirect();

  // Keyed on the topic so a switch drops the old topic's threads at once.
  return (
    <Suspense key={topicId ?? ""} fallback={<TutorSkeleton />}>
      <TutorContent userId={user._id.toHexString()} topicId={topicId} />
    </Suspense>
  );
}
