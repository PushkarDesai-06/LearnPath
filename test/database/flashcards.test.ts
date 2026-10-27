/**
 * Flashcards against a real MongoDB: the unique deck index keeps concurrent
 * requests from running the agent twice, the review count fences parallel
 * grades, and the page reads see what the routes wrote.
 */
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  curriculaCollection,
  flashcardDecksCollection,
  flashcardsCollection,
  lessonsCollection,
  progressEventsCollection,
} from "@/lib/db/collections";
import { requestFlashcardDeck, reviewFlashcard } from "@/lib/server/flashcards";
import { getFlashcardsPage } from "@/lib/data/flashcards";
import { readLessonView } from "@/lib/data/lesson";
import { getDashboard } from "@/lib/data/progress";
import { DECK_DAILY_LIMIT, DECK_STALE_MS, NEW_CARD } from "@/lib/domain/flashcards";
import { curriculumFixture } from "../helpers/curriculum";

const ai = vi.hoisted(() => ({ flashcards: vi.fn() }));
vi.mock("@/lib/ai/agents/flashcards", () => ({ runFlashcardAgent: ai.flashcards }));
vi.mock("@/lib/ai/provider", () => ({ modelName: () => "test" }));

// Explicit opt-in; never load .env.local or connect to the application's DB.
const uri = process.env.RELIABILITY_TEST_DB_URI;

async function seedLesson() {
  const curriculum = curriculumFixture();
  await (await curriculaCollection()).create(curriculum);
  await (await lessonsCollection()).create({
    _id: new ObjectId(), userId: curriculum.userId, curriculumId: curriculum._id,
    lessonRef: "lesson-1", title: "Lesson", generatedAt: new Date(), model: "test", genStatus: "ready",
    blocks: [{ kind: "text", blockId: "b1", markdown: "Recursion calls itself." }],
  });
  return { userId: curriculum.userId, curriculumId: curriculum._id, lessonRef: "lesson-1" };
}

describe.skipIf(!uri)("flashcards against MongoDB", () => {
  beforeAll(async () => {
    vi.stubEnv("MONGODB_URI", uri!);
    vi.stubEnv("MONGODB_DB", `learnpath_test_${randomUUID().replaceAll("-", "")}`);
    for (const collection of [
      curriculaCollection, lessonsCollection, progressEventsCollection,
      flashcardDecksCollection, flashcardsCollection,
    ]) {
      await (await collection()).init();
    }
  }, 15000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    vi.unstubAllEnvs();
  });

  it("writes one deck for simultaneous requests and shows it on every read", async () => {
    const { userId, curriculumId, lessonRef } = await seedLesson();
    ai.flashcards.mockReset();
    ai.flashcards.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 100));
      return { cards: [
        { front: "What is recursion?", back: "A function calling itself." },
        { front: "What ends it?", back: "A base case." },
        { front: "Risk?", back: "Stack overflow." },
      ] };
    });
    const results = await Promise.all(Array.from({ length: 5 }, () => requestFlashcardDeck({ userId, lessonRef })));

    expect(ai.flashcards).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.status === "ready")).toEqual([{ status: "ready", cardCount: 3 }]);
    expect(results.filter((r) => r.status === "generating")).toHaveLength(4);
    expect(await requestFlashcardDeck({ userId, lessonRef })).toEqual({ status: "ready", cardCount: 3 });
    expect(await (await flashcardsCollection()).countDocuments({ userId, curriculumId })).toBe(3);

    const page = await getFlashcardsPage(userId.toHexString(), curriculumId.toHexString());
    expect(page).toMatchObject({
      hasCurriculum: true, dueCount: 3, totalCount: 3, nextDueAt: null,
      lessons: [{ lessonRef, lessonTitle: "lesson-1", cardCount: 3, dueCount: 3 }],
    });
    const view = await readLessonView(userId.toHexString(), lessonRef);
    expect(view).toMatchObject({ status: "ready", lesson: { flashcards: { made: true, cardCount: 3 } } });
    const dashboard = await getDashboard(userId.toHexString(), curriculumId.toHexString());
    expect(dashboard).toMatchObject({ flashcards: { total: 3, due: 3 } });
  });

  it("applies only one of two simultaneous grades of the same card", async () => {
    const { userId, curriculumId, lessonRef } = await seedLesson();
    ai.flashcards.mockReset();
    ai.flashcards.mockResolvedValue({ cards: [{ front: "Q", back: "A" }, { front: "Q2", back: "A2" }, { front: "Q3", back: "A3" }] });
    await requestFlashcardDeck({ userId, lessonRef });
    const cards = await flashcardsCollection();
    const card = await cards.findOne({ userId, curriculumId, front: "Q" }).lean();

    const results = await Promise.allSettled([
      reviewFlashcard({ userId, cardId: card!._id.toHexString(), grade: "good" }),
      reviewFlashcard({ userId, cardId: card!._id.toHexString(), grade: "easy" }),
    ]);
    const saved = await cards.findOne({ _id: card!._id }).lean();
    expect(saved!.reviewCount).toBe(results.filter((r) => r.status === "fulfilled").length);
    expect(saved!.reps).toBe(saved!.reviewCount);
    for (const r of results.filter((r) => r.status === "rejected")) {
      expect((r as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
    }

    // A graded card leaves the due queue, and the page knows when it's back.
    const page = await getFlashcardsPage(userId.toHexString(), curriculumId.toHexString());
    expect(page).toMatchObject({ dueCount: 2, totalCount: 3 });
    expect(page.hasCurriculum && page.nextDueAt).toBe(saved!.due.toISOString());

    // Another learner can't grade it.
    await expect(reviewFlashcard({ userId: new ObjectId(), cardId: card!._id.toHexString(), grade: "good" }))
      .rejects.toMatchObject({ status: 404 });
  });

  it("replaces the cards a dead run left behind when it takes over the deck", async () => {
    const { userId, curriculumId, lessonRef } = await seedLesson();
    const decks = await flashcardDecksCollection();
    const cards = await flashcardsCollection();
    const old = new Date(Date.now() - DECK_STALE_MS - 1000);
    const deckId = new ObjectId();
    await decks.create({
      _id: deckId, userId, curriculumId, lessonRef, status: "generating",
      claimToken: "dead-request", claimedAt: old, attempts: 1, createdAt: old, updatedAt: old,
    });
    // The dead run got as far as inserting its cards.
    await cards.insertMany(["Left 1", "Left 2"].map((front) => ({
      _id: new ObjectId(), userId, curriculumId, lessonRef, deckId, front, back: "b",
      ...NEW_CARD, due: old, reviewCount: 0, createdAt: old, updatedAt: old,
    })));
    ai.flashcards.mockReset();
    ai.flashcards.mockResolvedValue({ cards: [{ front: "Q", back: "A" }, { front: "Q2", back: "A2" }, { front: "Q3", back: "A3" }] });

    expect(await requestFlashcardDeck({ userId, lessonRef })).toEqual({ status: "ready", cardCount: 3 });
    const fronts = (await cards.find({ userId, curriculumId }).lean()).map((c) => c.front).sort();
    expect(fronts).toEqual(["Q", "Q2", "Q3"]);
    expect(await decks.findOne({ _id: deckId }).lean()).toMatchObject({ status: "ready", attempts: 2 });
  });

  it("lets exactly one of several parallel lessons take the last deck of the day", async () => {
    const curriculum = curriculumFixture();
    const userId = curriculum.userId;
    curriculum.modules[0].lessons = ["a", "b", "c"].map((id, order) => ({ ...curriculum.modules[0].lessons[0], id, title: id, order }));
    await (await curriculaCollection()).create(curriculum);
    await (await lessonsCollection()).insertMany(["a", "b", "c"].map((lessonRef) => ({
      _id: new ObjectId(), userId, curriculumId: curriculum._id, lessonRef, title: lessonRef,
      generatedAt: new Date(), model: "test", genStatus: "ready",
      blocks: [{ kind: "text", blockId: "b1", markdown: "Text." }],
    })));
    const decks = await flashcardDecksCollection();
    const now = new Date();
    await decks.insertMany(Array.from({ length: DECK_DAILY_LIMIT - 1 }, (_, i) => ({
      _id: new ObjectId(), userId, curriculumId: new ObjectId(), lessonRef: `old-${i}`,
      status: "ready", attempts: 1, createdAt: now, updatedAt: now,
    })));
    ai.flashcards.mockReset();
    ai.flashcards.mockResolvedValue({ cards: [{ front: "Q", back: "A" }, { front: "Q2", back: "A2" }, { front: "Q3", back: "A3" }] });

    const results = await Promise.allSettled(["a", "b", "c"].map((lessonRef) => requestFlashcardDeck({ userId, lessonRef })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results.filter((r) => r.status === "rejected")) {
      expect((r as PromiseRejectedResult).reason).toMatchObject({ status: 429 });
    }
    expect(ai.flashcards).toHaveBeenCalledTimes(1);
    expect(await decks.countDocuments({ userId })).toBe(DECK_DAILY_LIMIT);
  });
});
