import { Suspense } from "react";
import { requireUserOrRedirect } from "@/lib/auth/current";
import { getConversation, listConversations } from "@/lib/data/tutor";
import { TutorChat } from "./TutorChat";
import { TutorSkeleton } from "./TutorParts";
import { NoTopicState } from "@/components/NoTopicState";

import type { Metadata } from "next";
import { topicPageMetadata } from "@/lib/data/metadata";

export function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}): Promise<Metadata> {
  return topicPageMetadata("Tutor", searchParams);
}

/** Threads + the newest thread's transcript, read on the server. */
async function TutorContent({
  userId,
  topicId,
}: {
  userId: string;
  topicId: string | null;
}) {
  const list = await listConversations(userId, topicId);
  // No topic to tutor on: the API refuses to chat without one, so say why
  // instead of offering a composer that can't send.
  if (!list || !list.curriculumId)
    return <NoTopicState userId={userId} requestedId={topicId} />;
  const first = list.conversations[0];
  const initial = first ? await getConversation(userId, first.id) : null;

  return (
    <TutorChat
      curriculumId={list.curriculumId}
      topicTitle={list.title ?? ""}
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
