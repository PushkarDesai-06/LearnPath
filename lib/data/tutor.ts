/**
 * Tutor conversation reads. Absorbs the former `GET /api/tutor/conversations`
 * and `GET /api/tutor?conversationId=`. Sending stays `POST /api/tutor`.
 */
import "server-only";
import { ObjectId } from "mongodb";
import { chatsCollection } from "@/lib/db/collections";
import { resolveCurriculum } from "@/lib/server/curriculumLocate";
import type { ConversationDTO, ConversationSummary } from "@/lib/data/types";
import { tidyCurriculumTitle } from "@/lib/domain/title";

/**
 * A topic's threads, newest first. `null` = the requested topic doesn't exist
 * or isn't owned; `curriculumId: null` = the learner has no topic at all yet.
 */
export async function listConversations(
  userId: string,
  curriculumId?: string | null,
): Promise<{
  curriculumId: string | null;
  /** The topic the tutor is grounded in (null with no topic). */
  title: string | null;
  conversations: ConversationSummary[];
} | null> {
  const uid = new ObjectId(userId);
  const curriculum = await resolveCurriculum(uid, curriculumId);
  if (!curriculum) {
    return curriculumId ? null : { curriculumId: null, title: null, conversations: [] };
  }

  const chats = await chatsCollection();
  const docs = await chats
    .find({ userId: uid, curriculumId: curriculum._id })
    .sort({ updatedAt: -1 })
    .lean();

  return {
    curriculumId: curriculum._id.toHexString(),
    title: tidyCurriculumTitle(curriculum.title),
    conversations: docs.map((c) => ({
      id: c._id.toHexString(),
      title: c.title ?? "Conversation",
      messageCount: c.messages.length,
      updatedAt: c.updatedAt.toISOString(),
    })),
  };
}

/** One owned thread's messages, or null. */
export async function getConversation(
  userId: string,
  conversationId: string,
): Promise<ConversationDTO | null> {
  if (!ObjectId.isValid(conversationId)) return null;
  const chats = await chatsCollection();
  const chat = await chats
    .findOne({
      _id: new ObjectId(conversationId),
      userId: new ObjectId(userId),
    })
    .lean();
  if (!chat) return null;
  return {
    conversationId: chat._id.toHexString(),
    title: chat.title ?? "Conversation",
    messages: chat.messages.map((m) => ({ role: m.role, content: m.content })),
  };
}
