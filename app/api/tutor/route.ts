/**
 * Socratic tutor chat. Scoped to the learner's current curriculum (and a lesson
 * if provided), so one persistent conversation is kept per scope. Guides toward
 * answers without revealing them; history persists in the chats collection.
 */
import { z } from "zod";
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth/guards";
import { chatsCollection, curriculaCollection } from "@/lib/db/collections";
import type { ChatDoc, ChatMessage } from "@/lib/db/models";
import { runSocraticTutorAgent } from "@/lib/ai/agents/tutor";
import { locateLesson } from "@/lib/server/curriculumLocate";
import { badRequest, handler, json, readJson } from "@/lib/http";

// How many past messages to send to the model (keeps prompts bounded).
const HISTORY_WINDOW = 20;

const Body = z.object({
  message: z.string().trim().min(1),
  lessonRef: z.string().optional(),
});

/**
 * Atomically find-or-create the single chat for a (user, curriculum, scope).
 * Uses an upsert (race-safe alongside the unique index on the scope) so
 * concurrent messages can't fork the conversation into duplicate docs.
 *
 * NOTE: scope by `lessonRef: null`, not `{ $exists: false }` — an absent
 * lessonRef is persisted as `null`, which `{ $exists: false }` would not match.
 */
async function getOrCreateChat(
  userId: ObjectId,
  curriculumId: ObjectId,
  lessonRef: string | undefined,
): Promise<ChatDoc> {
  const chats = await chatsCollection();
  const now = new Date();
  const doc = await chats
    .findOneAndUpdate(
      { userId, curriculumId, lessonRef: lessonRef ?? null },
      { $setOnInsert: { messages: [], createdAt: now, updatedAt: now } },
      { upsert: true, new: true },
    )
    .lean();
  // With upsert + new:true this is always present.
  return doc as ChatDoc;
}

async function currentCurriculumId(userId: ObjectId): Promise<ObjectId | null> {
  const curricula = await curriculaCollection();
  const curriculum = await curricula
    .findOne({ userId })
    .sort({ createdAt: -1 })
    .select({ _id: 1 })
    .lean();
  return curriculum?._id ?? null;
}

/** GET — load the persisted conversation so the UI can restore it. */
export const GET = handler(async (request) => {
  const user = await requireUser();
  const url = new URL(request.url);
  const lessonRef = url.searchParams.get("lessonRef") ?? undefined;

  const curriculumId = await currentCurriculumId(user._id);
  if (!curriculumId) return json({ messages: [] });

  const chat = await getOrCreateChat(user._id, curriculumId, lessonRef);
  return json({
    messages: chat.messages.map((m) => ({ role: m.role, content: m.content })),
  });
});

/** POST — send a message; appends to the same conversation and replies. */
export const POST = handler(async (request) => {
  const user = await requireUser();
  const { message, lessonRef } = await readJson(request, Body);

  const curriculumId = await currentCurriculumId(user._id);
  if (!curriculumId) {
    throw badRequest("Generate a curriculum before using the tutor");
  }

  // Optional lesson context for grounding.
  let lessonContext: string | undefined;
  if (lessonRef) {
    const located = await locateLesson(user._id, lessonRef);
    if (located) {
      lessonContext = `Lesson "${located.lesson.title}". Objectives: ${located.lesson.objectives.join("; ")}`;
    }
  }

  const chat = await getOrCreateChat(user._id, curriculumId, lessonRef);

  const result = await runSocraticTutorAgent({
    lessonContext,
    history: chat.messages.slice(-HISTORY_WINDOW),
    userMessage: message,
  });

  const now = new Date();
  const userMsg: ChatMessage = { role: "user", content: message, at: now };
  const assistantMsg: ChatMessage = {
    role: "assistant",
    content: result.reply,
    at: new Date(),
  };
  const chats = await chatsCollection();
  await chats.updateOne(
    { _id: chat._id },
    {
      $push: { messages: { $each: [userMsg, assistantMsg] } },
      $set: { updatedAt: new Date() },
    },
  );

  return json({
    reply: result.reply,
    gaveDirectAnswer: result.gaveDirectAnswer,
  });
});
