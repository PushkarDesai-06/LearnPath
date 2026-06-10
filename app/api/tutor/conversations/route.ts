/**
 * List a topic's tutor conversations (newest first). Used by the tutor UI to
 * show past threads and let the learner switch between them.
 */
import { requireUser } from "@/lib/auth/guards";
import { chatsCollection } from "@/lib/db/collections";
import { resolveCurriculum } from "@/lib/server/curriculumLocate";
import { handler, json, notFound } from "@/lib/http";

export const GET = handler(async (request) => {
  const user = await requireUser();
  const curriculumId = new URL(request.url).searchParams.get("curriculumId");

  const curriculum = await resolveCurriculum(user._id, curriculumId);
  if (!curriculum) {
    if (curriculumId) throw notFound("Topic not found");
    return json({ conversations: [] }); // no topic yet
  }

  const chats = await chatsCollection();
  const docs = await chats
    .find({ userId: user._id, curriculumId: curriculum._id })
    .sort({ updatedAt: -1 })
    .lean();

  return json({
    curriculumId: curriculum._id.toHexString(),
    conversations: docs.map((c) => ({
      id: c._id.toHexString(),
      title: c.title ?? "Conversation",
      messageCount: c.messages.length,
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
});
