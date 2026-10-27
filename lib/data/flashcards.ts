/**
 * Flashcard reads for the review page, the lesson page and the dashboard.
 * Pure reads: cards are only written by an explicit POST (lib/server/flashcards).
 */
import "server-only";
import { ObjectId } from "mongodb";
import { flashcardDecksCollection, flashcardsCollection } from "@/lib/db/collections";
import { resolveCurriculum } from "@/lib/server/curriculumLocate";
import { REVIEW_SESSION_LIMIT } from "@/lib/domain/flashcards";
import type { FlashcardsPageData, LessonDTO } from "@/lib/data/types";

/** Cards in a topic, and how many are due now. */
export async function flashcardCounts(
  userId: ObjectId,
  curriculumId: ObjectId,
): Promise<{ total: number; due: number }> {
  const cards = await flashcardsCollection();
  const filter = { userId, curriculumId };
  const [total, due] = await Promise.all([
    cards.countDocuments(filter),
    cards.countDocuments({ ...filter, due: { $lte: new Date() } }),
  ]);
  return { total, due };
}

/** Whether a lesson's cards have been written, and how many are left. */
export async function lessonFlashcards(
  userId: ObjectId,
  curriculumId: ObjectId,
  lessonRef: string,
): Promise<NonNullable<LessonDTO["flashcards"]>> {
  const filter = { userId, curriculumId, lessonRef };
  const [deck, cardCount] = await Promise.all([
    flashcardDecksCollection().then((d) => d.findOne(filter, { status: 1 }).lean()),
    flashcardsCollection().then((c) => c.countDocuments(filter)),
  ]);
  return { made: deck?.status === "ready", cardCount };
}

/**
 * The review page: today's session (due cards, soonest first) plus a per-lesson
 * breakdown. `curriculumId` selects a topic, owner-scoped like the dashboard.
 */
export async function getFlashcardsPage(
  userId: string,
  curriculumId?: string | null,
): Promise<FlashcardsPageData> {
  const uid = new ObjectId(userId);
  const curriculum = await resolveCurriculum(uid, curriculumId);
  if (!curriculum) return { hasCurriculum: false };

  const lessons = curriculum.modules
    .slice()
    .sort((a, b) => a.order - b.order)
    .flatMap((m) => m.lessons.slice().sort((a, b) => a.order - b.order));
  const titles = new Map(lessons.map((l) => [l.id, l.title]));

  const cards = await flashcardsCollection();
  const now = new Date();
  const filter = { userId: uid, curriculumId: curriculum._id };
  const [due, perLesson, next] = await Promise.all([
    cards
      .find({ ...filter, due: { $lte: now } })
      .sort({ due: 1 })
      .limit(REVIEW_SESSION_LIMIT)
      .lean(),
    cards.aggregate<{ _id: string; cardCount: number; dueCount: number }>([
      { $match: filter },
      {
        $group: {
          _id: "$lessonRef",
          cardCount: { $sum: 1 },
          dueCount: { $sum: { $cond: [{ $lte: ["$due", now] }, 1, 0] } },
        },
      },
    ]),
    cards.findOne({ ...filter, due: { $gt: now } }, { due: 1 }).sort({ due: 1 }).lean(),
  ]);

  const counts = new Map(perLesson.map((row) => [row._id, row]));
  return {
    hasCurriculum: true,
    curriculumId: curriculum._id.toHexString(),
    title: curriculum.title,
    due: due.map((card) => ({
      id: card._id.toHexString(),
      front: card.front,
      back: card.back,
      lessonRef: card.lessonRef,
      lessonTitle: titles.get(card.lessonRef) ?? "Lesson",
      schedule: {
        reps: card.reps,
        intervalDays: card.intervalDays,
        ease: card.ease,
        lapses: card.lapses,
      },
    })),
    dueCount: perLesson.reduce((sum, row) => sum + row.dueCount, 0),
    totalCount: perLesson.reduce((sum, row) => sum + row.cardCount, 0),
    nextDueAt: next?.due.toISOString() ?? null,
    // Path order, only lessons that have cards.
    lessons: lessons.flatMap((l) => {
      const row = counts.get(l.id);
      return row
        ? [{ lessonRef: l.id, lessonTitle: l.title, cardCount: row.cardCount, dueCount: row.dueCount }]
        : [];
    }),
  };
}
