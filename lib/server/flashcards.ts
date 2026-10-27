/**
 * Flashcards: write a lesson's cards, grade a review, remove a card, export a
 * topic to Anki.
 *
 * Writing cards runs inside the learner's request (one short list, and only an
 * explicit POST starts it, so prefetch can't). It is guarded the way block
 * variants are:
 *  - Dedup: the unique (user, topic, lesson) deck index means only the insert
 *    that wins runs the agent; concurrent requests report `generating`.
 *  - Fencing: each run holds a claim token, and only the holder may finish.
 *  - Recovery: a failed deck, or one whose request died mid-run, is taken over
 *    by the next request until MAX_DECK_ATTEMPTS is used up.
 *
 * Reviews are self-graded, so they never touch mastery or the path.
 */
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import {
  flashcardDecksCollection,
  flashcardsCollection,
  lessonsCollection,
  progressEventsCollection,
} from "@/lib/db/collections";
import type { FlashcardDeckDoc, FlashcardDoc, FlashcardGrade } from "@/lib/db/models";
import type { FlashcardDeckResult, FlashcardReviewResult } from "@/lib/data/types";
import { runFlashcardAgent } from "@/lib/ai/agents/flashcards";
import { modelName } from "@/lib/ai/provider";
import { locateLesson, resolveCurriculum } from "@/lib/server/curriculumLocate";
import { requireLessonAccess } from "@/lib/server/lessonAccess";
import { isLessonReady } from "@/lib/server/lessonReady";
import {
  cleanCards,
  deckClaimState,
  DECK_DAILY_LIMIT,
  DECK_WINDOW_MS,
  NEW_CARD,
  scheduleCard,
  toAnkiText,
} from "@/lib/domain/flashcards";
import { ApiError, conflict, notFound } from "@/lib/http";

/**
 * Same reservation scheme as block variants: runs right after a new deck record
 * is inserted and counts only records up to and including it (by `_id`), so
 * exactly the first DECK_DAILY_LIMIT reservations in the window succeed even
 * when requests race. A later one removes itself before the model is called.
 */
async function enforceDailyLimit(
  userId: ObjectId,
  reservation: { _id: ObjectId; claimToken: string },
): Promise<void> {
  const decks = await flashcardDecksCollection();
  const used = await decks.countDocuments({
    userId,
    createdAt: { $gte: new Date(Date.now() - DECK_WINDOW_MS) },
    _id: { $lte: reservation._id },
  });
  if (used > DECK_DAILY_LIMIT) {
    await decks.deleteOne(reservation);
    throw new ApiError(
      429,
      `You've made flashcards from ${DECK_DAILY_LIMIT} lessons today. More unlock over the next 24 hours.`,
    );
  }
}

async function countCards(filter: { userId: ObjectId; curriculumId: ObjectId; lessonRef: string }) {
  return (await flashcardsCollection()).countDocuments(filter);
}

export async function requestFlashcardDeck({
  userId,
  lessonRef,
}: {
  userId: ObjectId;
  lessonRef: string;
}): Promise<FlashcardDeckResult> {
  const located = await locateLesson(userId, lessonRef);
  if (!located) throw notFound("Lesson not found");
  requireLessonAccess(located.curriculum, lessonRef);
  const { curriculum, lesson } = located;

  const identity = { userId, curriculumId: curriculum._id, lessonRef };
  const lessonDoc = await (await lessonsCollection()).findOne(identity).lean();
  if (!lessonDoc || !isLessonReady(lessonDoc)) throw conflict("This lesson isn't ready yet.");

  const decks = await flashcardDecksCollection();
  const generating: FlashcardDeckResult = { status: "generating" };
  const claimToken = randomUUID();
  const now = new Date();
  let id: ObjectId;

  const existing = (await decks.findOne(identity).lean()) as FlashcardDeckDoc | null;
  if (existing) {
    const state = deckClaimState(existing);
    if (state === "ready") return { status: "ready", cardCount: await countCards(identity) };
    if (state === "busy") return generating;
    if (state === "exhausted") {
      throw conflict("We couldn't write flashcards for this lesson after several attempts.");
    }
    // Take over the failed or abandoned record, conditioned on the claim we saw.
    const took = await decks.updateOne(
      { _id: existing._id, status: existing.status, claimToken: existing.claimToken ?? null },
      {
        $set: { status: "generating", claimToken, claimedAt: now, error: null, updatedAt: now },
        $inc: { attempts: 1 },
      },
    );
    if (!took.matchedCount) return generating; // a concurrent request took it first
    id = existing._id;
  } else {
    id = new ObjectId();
    try {
      await decks.create({
        _id: id,
        ...identity,
        status: "generating",
        claimToken,
        claimedAt: now,
        attempts: 1,
        createdAt: now,
        updatedAt: now,
      });
    } catch (err) {
      if ((err as { code?: number })?.code !== 11000) throw err;
      return generating; // a concurrent request inserted first and is writing them
    }
    await enforceDailyLimit(userId, { _id: id, claimToken });
  }

  const owned = { _id: id, claimToken };
  try {
    const output = await runFlashcardAgent({
      lessonTitle: lesson.title,
      objectives: lesson.objectives,
      blocks: lessonDoc.blocks,
    });
    const written = cleanCards(output.cards);
    if (!written.length) throw new Error("The model returned no usable cards");

    // Insert first, then finish the claim. If the claim was taken over while
    // the agent ran, the cards belong to the new owner's run: remove ours.
    const cards = await flashcardsCollection();
    const stamp = new Date();
    const inserted = await cards.insertMany(
      written.map((card) => ({
        _id: new ObjectId(),
        ...identity,
        deckId: id,
        ...card,
        ...NEW_CARD,
        due: stamp,
        reviewCount: 0,
        lastReviewedAt: null,
        createdAt: stamp,
        updatedAt: stamp,
      })),
    );
    const saved = await decks.updateOne(owned, {
      $set: {
        status: "ready",
        model: modelName(),
        claimToken: null,
        claimedAt: null,
        updatedAt: new Date(),
      },
    });
    if (!saved.matchedCount) {
      await cards.deleteMany({ _id: { $in: inserted.map((c) => c._id) } });
      return generating;
    }
    const events = await progressEventsCollection();
    await events.create({
      _id: new ObjectId(),
      userId,
      curriculumId: curriculum._id,
      lessonRef,
      type: "flashcards_created",
      topics: lesson.topics,
      at: new Date(),
    });
    return { status: "ready", cardCount: written.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[flashcards] generation failed:", lessonRef, message);
    await decks.updateOne(owned, {
      $set: { status: "failed", error: message, claimToken: null, claimedAt: null, updatedAt: new Date() },
    });
    throw err;
  }
}

function cardFilter(userId: ObjectId, cardId: string) {
  if (!ObjectId.isValid(cardId)) throw notFound("Card not found");
  return { _id: new ObjectId(cardId), userId };
}

/**
 * Apply one grade. `reviewCount` fences the write, so the same card graded in
 * two tabs at once can't double-apply a schedule computed from stale state.
 */
export async function reviewFlashcard({
  userId,
  cardId,
  grade,
}: {
  userId: ObjectId;
  cardId: string;
  grade: FlashcardGrade;
}): Promise<FlashcardReviewResult> {
  const cards = await flashcardsCollection();
  const filter = cardFilter(userId, cardId);
  const card = (await cards.findOne(filter).lean()) as FlashcardDoc | null;
  if (!card) throw notFound("Card not found");

  const now = new Date();
  const next = scheduleCard(card, grade, now.getTime());
  const saved = await cards.updateOne(
    { ...filter, reviewCount: card.reviewCount ?? 0 },
    {
      $set: { ...next, lastReviewedAt: now, updatedAt: now },
      $inc: { reviewCount: 1 },
    },
  );
  if (!saved.matchedCount) throw conflict("This card was just reviewed somewhere else.");
  const { due, ...schedule } = next;
  return { schedule, due: due.toISOString() };
}

export async function deleteFlashcard({ userId, cardId }: { userId: ObjectId; cardId: string }) {
  const cards = await flashcardsCollection();
  const removed = await cards.deleteOne(cardFilter(userId, cardId));
  if (!removed.deletedCount) throw notFound("Card not found");
}

/** Every card in a topic as an Anki import file. Null when the topic isn't the learner's. */
export async function exportFlashcards(
  userId: ObjectId,
  curriculumId: string | null,
): Promise<{ filename: string; text: string } | null> {
  const curriculum = await resolveCurriculum(userId, curriculumId);
  if (!curriculum) return null;
  const titles = new Map(
    curriculum.modules.flatMap((m) => m.lessons.map((l) => [l.id, l.title] as const)),
  );
  const order = new Map([...titles.keys()].map((id, i) => [id, i]));
  const cards = await (await flashcardsCollection())
    .find({ userId, curriculumId: curriculum._id }, { lessonRef: 1, front: 1, back: 1, createdAt: 1 })
    .sort({ createdAt: 1 })
    .lean();
  // Path order, so the deck reads the way the topic is taught.
  cards.sort((a, b) => (order.get(a.lessonRef) ?? 1e9) - (order.get(b.lessonRef) ?? 1e9));
  const slug = curriculum.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "topic";
  return {
    filename: `learnpath-${slug}.txt`,
    text: toAnkiText(
      curriculum.title,
      cards.map((c) => ({ front: c.front, back: c.back, lessonTitle: titles.get(c.lessonRef) ?? "Lesson" })),
    ),
  };
}
