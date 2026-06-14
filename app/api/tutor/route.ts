/**
 * Socratic tutor chat with MULTIPLE conversations per topic.
 *
 * A conversation's identity is its `_id` (conversationId). POST without a
 * conversationId starts a new thread; with one, it appends. `lessonRef` is just
 * a context tag for where a thread was started. History persists per thread.
 */
import { z } from "zod";
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth/guards";
import { chatsCollection } from "@/lib/db/collections";
import type { ChatDoc, ChatMessage } from "@/lib/db/models";
import { runSocraticTutorAgent } from "@/lib/ai/agents/tutor";
import { locateLesson, resolveCurriculum } from "@/lib/server/curriculumLocate";
import { badRequest, handler, json, notFound, readJson } from "@/lib/http";

const HISTORY_WINDOW = 20;

const Body = z.object({
  message: z.string().trim().min(1),
  curriculumId: z.string().optional(),
  conversationId: z.string().optional(),
  lessonRef: z.string().optional(),
});

function deriveTitle(message: string): string {
  const t = message.trim().replace(/\s+/g, " ");
  return t.length > 48 ? t.slice(0, 48) + "…" : t;
}

/** GET ?conversationId= — load one conversation's messages. */
export const GET = handler(async (request) => {
  const user = await requireUser();
  const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (!conversationId || !ObjectId.isValid(conversationId)) {
    throw badRequest("conversationId required");
  }

  const chats = await chatsCollection();
  const chat = await chats
    .findOne({ _id: new ObjectId(conversationId), userId: user._id })
    .lean();
  if (!chat) throw notFound("Conversation not found");

  return json({
    conversationId: chat._id.toHexString(),
    title: chat.title ?? "Conversation",
    messages: chat.messages.map((m) => ({ role: m.role, content: m.content })),
  });
});

/** POST — send a message to a thread (new if no conversationId). */
export const POST = handler(async (request) => {
  const user = await requireUser();
  const { message, curriculumId, conversationId, lessonRef } = await readJson(
    request,
    Body,
  );

  const curriculum = await resolveCurriculum(user._id, curriculumId);
  if (!curriculum) {
    if (curriculumId) throw notFound("Topic not found");
    throw badRequest("Generate a curriculum before using the tutor");
  }

  const chats = await chatsCollection();
  const now = new Date();

  // Find the target conversation (must be owned), or start a new one.
  let chat: ChatDoc | null = null;
  if (conversationId) {
    if (!ObjectId.isValid(conversationId)) throw badRequest("Invalid conversationId");
    chat = await chats
      .findOne({
        _id: new ObjectId(conversationId),
        userId: user._id,
        curriculumId: curriculum._id,
      })
      .lean();
    if (!chat) throw notFound("Conversation not found");
  }
  if (!chat) {
    chat = {
      _id: new ObjectId(),
      userId: user._id,
      curriculumId: curriculum._id,
      lessonRef: lessonRef ?? null,
      title: deriveTitle(message),
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    await chats.create(chat);
  }

  // Optional lesson grounding.
  let lessonContext: string | undefined;
  const ref = lessonRef ?? chat.lessonRef ?? undefined;
  if (ref) {
    const located = await locateLesson(user._id, ref);
    if (located) {
      lessonContext = `Lesson "${located.lesson.title}". Objectives: ${located.lesson.objectives.join("; ")}`;
    }
  }

  const result = await runSocraticTutorAgent({
    userId: user._id,
    curriculumId: curriculum._id,
    lessonContext,
    history: chat.messages.slice(-HISTORY_WINDOW),
    userMessage: message,
  });

  const userMsg: ChatMessage = { role: "user", content: message, at: now };
  const assistantMsg: ChatMessage = {
    role: "assistant",
    content: result.reply,
    at: new Date(),
  };
  await chats.updateOne(
    { _id: chat._id },
    {
      $push: { messages: { $each: [userMsg, assistantMsg] } },
      $set: { updatedAt: new Date() },
    },
  );

  return json({
    conversationId: chat._id.toHexString(),
    title: chat.title,
    reply: result.reply,
    gaveDirectAnswer: result.gaveDirectAnswer,
  });
});
