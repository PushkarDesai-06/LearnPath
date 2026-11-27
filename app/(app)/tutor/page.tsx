import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUserOrRedirect } from "@/lib/auth/current";
import { getConversation, listConversations } from "@/lib/data/tutor";
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
  const initial = first ? await getConversation(userId, first.id) : null;

  return (
    <TutorChat
      curriculumId={list.curriculumId}
      initialConversations={list.conversations}
      initialActiveId={initial?.conversationId ?? null}
      initialMessages={initial?.messages ?? []}
    />
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
