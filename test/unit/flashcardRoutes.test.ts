/**
 * The flashcard routes: making a deck follows the lesson's ownership and
 * module-access rules, runs the agent once per lesson, fences its save, and
 * holds the daily limit; reviews reschedule only the learner's own card and
 * refuse a stale write; export is owner-scoped.
 */
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurriculumDoc, FlashcardDeckDoc, LessonDoc } from "@/lib/db/models";
import { curriculumFixture, lessonFixture } from "../helpers/curriculum";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), locate: vi.fn(), resolve: vi.fn(), agent: vi.fn(),
  lessonFind: vi.fn(),
  deckFind: vi.fn(), deckCreate: vi.fn(), deckUpdate: vi.fn(), deckCount: vi.fn(), deckDelete: vi.fn(),
  cardInsert: vi.fn(), cardCount: vi.fn(), cardFind: vi.fn(), cardFindMany: vi.fn(),
  cardUpdate: vi.fn(), cardDelete: vi.fn(), cardDeleteMany: vi.fn(),
  eventCreate: vi.fn(),
}));
vi.mock("@/lib/auth/guards", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/server/curriculumLocate", () => ({ locateLesson: mocks.locate, resolveCurriculum: mocks.resolve }));
vi.mock("@/lib/ai/agents/flashcards", () => ({ runFlashcardAgent: mocks.agent }));
vi.mock("@/lib/ai/provider", () => ({ modelName: () => "test-model" }));
vi.mock("@/lib/db/collections", () => ({
  lessonsCollection: async () => ({ findOne: mocks.lessonFind }),
  flashcardDecksCollection: async () => ({
    findOne: mocks.deckFind, create: mocks.deckCreate, updateOne: mocks.deckUpdate,
    countDocuments: mocks.deckCount, deleteOne: mocks.deckDelete,
  }),
  flashcardsCollection: async () => ({
    insertMany: mocks.cardInsert, countDocuments: mocks.cardCount, findOne: mocks.cardFind,
    find: mocks.cardFindMany, updateOne: mocks.cardUpdate, deleteOne: mocks.cardDelete,
    deleteMany: mocks.cardDeleteMany,
  }),
  progressEventsCollection: async () => ({ create: mocks.eventCreate }),
}));
import { POST as makeDeck } from "@/app/api/lesson/[lessonId]/flashcards/route";
import { POST as review } from "@/app/api/flashcards/[cardId]/review/route";
import { DELETE as removeCard } from "@/app/api/flashcards/[cardId]/route";
import { GET as exportDeck } from "@/app/api/flashcards/export/route";
import { DECK_DAILY_LIMIT, NEW_CARD, RELEARN_MS } from "@/lib/domain/flashcards";

let curriculum: CurriculumDoc;
let lesson: LessonDoc;
const make = () =>
  makeDeck(new Request("http://localhost/api/lesson/lesson-1/flashcards", { method: "POST" }), {
    params: Promise.resolve({ lessonId: "lesson-1" }),
  });
const grade = (cardId: string, body: unknown) =>
  review(new Request(`http://localhost/api/flashcards/${cardId}/review`, {
    method: "POST", body: JSON.stringify(body),
  }), { params: Promise.resolve({ cardId }) });
const deck = (fields: Partial<FlashcardDeckDoc>) => ({
  _id: new ObjectId(), status: "ready", attempts: 1, claimToken: null, ...fields,
});
const cards = [
  { front: "What is recursion?", back: "A function calling itself." },
  { front: "What stops recursion?", back: "A base case." },
  { front: "What stops recursion?", back: "Duplicate." },
];

beforeEach(() => {
  vi.resetAllMocks();
  curriculum = curriculumFixture();
  lesson = {
    _id: new ObjectId(), userId: curriculum.userId, curriculumId: curriculum._id,
    lessonRef: "lesson-1", title: "Lesson", generatedAt: new Date(), model: "m", genStatus: "ready",
    blocks: [{ kind: "text", blockId: "b1", markdown: "Recursion is a function calling itself." }],
  };
  mocks.user.mockResolvedValue({ _id: curriculum.userId });
  mocks.locate.mockResolvedValue({ curriculum, module: curriculum.modules[0], lesson: curriculum.modules[0].lessons[0] });
  mocks.resolve.mockResolvedValue(curriculum);
  mocks.lessonFind.mockImplementation(() => ({ lean: async () => lesson }));
  mocks.deckFind.mockImplementation(() => ({ lean: async () => null }));
  mocks.deckCount.mockResolvedValue(0);
  mocks.deckCreate.mockResolvedValue({});
  mocks.deckUpdate.mockResolvedValue({ matchedCount: 1 });
  mocks.cardInsert.mockImplementation(async (docs: unknown[]) => docs);
  mocks.cardUpdate.mockResolvedValue({ matchedCount: 1 });
  mocks.agent.mockResolvedValue({ cards });
});

describe("POST /api/lesson/[id]/flashcards", () => {
  it("writes cleaned cards as new cards due now, finishes its claim and logs one event", async () => {
    const res = await make();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ready", cardCount: 2 });
    expect(mocks.agent.mock.calls[0][0]).toMatchObject({ lessonTitle: "lesson-1", blocks: lesson.blocks });

    const created = mocks.deckCreate.mock.calls[0][0];
    expect(created).toMatchObject({
      userId: curriculum.userId, curriculumId: curriculum._id, lessonRef: "lesson-1",
      status: "generating", attempts: 1,
    });
    const inserted = mocks.cardInsert.mock.calls[0][0];
    expect(inserted).toHaveLength(2);
    expect(inserted[0]).toMatchObject({
      userId: curriculum.userId, curriculumId: curriculum._id, lessonRef: "lesson-1", deckId: created._id,
      front: "What is recursion?", ...NEW_CARD, reviewCount: 0,
    });
    const [filter, update] = mocks.deckUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: created._id, claimToken: created.claimToken });
    expect(update.$set).toMatchObject({ status: "ready", claimToken: null });
    expect(mocks.eventCreate.mock.calls[0][0]).toMatchObject({ type: "flashcards_created" });
  });

  it("returns an existing deck's count without calling the model or the quota", async () => {
    mocks.deckFind.mockImplementation(() => ({ lean: async () => deck({}) }));
    mocks.cardCount.mockResolvedValue(7);
    expect(await (await make()).json()).toEqual({ status: "ready", cardCount: 7 });
    expect(mocks.agent).not.toHaveBeenCalled();
    expect(mocks.deckCount).not.toHaveBeenCalled();
  });

  it("reports generating while another request writes the deck", async () => {
    mocks.deckFind.mockImplementation(() => ({
      lean: async () => deck({ status: "generating", claimToken: "t", claimedAt: new Date() }),
    }));
    expect(await (await make()).json()).toEqual({ status: "generating" });
    mocks.deckFind.mockImplementation(() => ({ lean: async () => null }));
    mocks.deckCreate.mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));
    expect(await (await make()).json()).toEqual({ status: "generating" });
    expect(mocks.agent).not.toHaveBeenCalled();
  });

  it("removes its cards when its claim was taken over mid-run", async () => {
    mocks.deckUpdate.mockResolvedValue({ matchedCount: 0 });
    expect(await (await make()).json()).toEqual({ status: "generating" });
    const ids = mocks.cardInsert.mock.calls[0][0].map((c: { _id: ObjectId }) => c._id);
    expect(mocks.cardDeleteMany).toHaveBeenCalledWith({ _id: { $in: ids } });
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("retries a failed deck by taking over its record, and stops at the attempt limit", async () => {
    const failed = deck({ status: "failed", attempts: 1 });
    mocks.deckFind.mockImplementation(() => ({ lean: async () => failed }));
    expect((await make()).status).toBe(200);
    expect(mocks.deckUpdate.mock.calls[0][0]).toEqual({ _id: failed._id, status: "failed", claimToken: null });
    expect(mocks.deckCreate).not.toHaveBeenCalled();

    mocks.deckFind.mockImplementation(() => ({ lean: async () => deck({ status: "failed", attempts: 3 }) }));
    mocks.agent.mockClear();
    expect((await make()).status).toBe(409);
    expect(mocks.agent).not.toHaveBeenCalled();
  });

  it("records a failure under its own claim", async () => {
    mocks.agent.mockRejectedValue(new Error("model down"));
    expect((await make()).status).toBe(500);
    const [filter, update] = mocks.deckUpdate.mock.calls[0];
    expect(filter.claimToken).toBe(mocks.deckCreate.mock.calls[0][0].claimToken);
    expect(update.$set).toMatchObject({ status: "failed", error: "model down", claimToken: null });
    expect(mocks.cardInsert).not.toHaveBeenCalled();
  });

  it("reserves first, then refuses and rolls back a deck past the daily limit", async () => {
    mocks.deckCount.mockResolvedValue(DECK_DAILY_LIMIT + 1);
    expect((await make()).status).toBe(429);
    const created = mocks.deckCreate.mock.calls[0][0];
    expect(mocks.deckCount.mock.calls[0][0]).toMatchObject({ userId: curriculum.userId, _id: { $lte: created._id } });
    expect(mocks.deckDelete).toHaveBeenCalledWith({ _id: created._id, claimToken: created.claimToken });
    expect(mocks.agent).not.toHaveBeenCalled();
  });

  it("404s another learner's lesson, 403s a locked module, 409s an unwritten lesson", async () => {
    mocks.locate.mockResolvedValueOnce(null);
    expect((await make()).status).toBe(404);
    lesson = { ...lesson, blocks: [], genStatus: "generating" };
    expect((await make()).status).toBe(409);
    curriculum.modules = Array.from({ length: 3 }, (_, i) => ({
      ...curriculum.modules[0], id: `m${i}`, order: i,
      lessons: [lessonFixture(i === 2 ? "lesson-1" : `l${i}`)],
    }));
    mocks.lessonFind.mockClear();
    expect((await make()).status).toBe(403);
    expect(mocks.lessonFind).not.toHaveBeenCalled();
  });
});

describe("POST /api/flashcards/[id]/review", () => {
  const id = new ObjectId();
  const card = { _id: id, userId: null as unknown, ...NEW_CARD, reviewCount: 2 };

  beforeEach(() => {
    card.userId = curriculum.userId;
    mocks.cardFind.mockImplementation(() => ({ lean: async () => card }));
  });

  it("reschedules the learner's own card, fenced on its review count", async () => {
    const res = await grade(id.toHexString(), { grade: "good" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.schedule).toEqual({ reps: 1, intervalDays: 1, ease: 2.5, lapses: 0 });
    expect(mocks.cardFind).toHaveBeenCalledWith({ _id: id, userId: curriculum.userId });
    const [filter, update] = mocks.cardUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: id, userId: curriculum.userId, reviewCount: 2 });
    expect(update.$inc).toEqual({ reviewCount: 1 });
    expect(update.$set).toMatchObject({ reps: 1, intervalDays: 1 });
  });

  it("brings a forgotten card back in minutes", async () => {
    const before = Date.now();
    const body = await (await grade(id.toHexString(), { grade: "again" })).json();
    expect(Date.parse(body.due) - before).toBeGreaterThanOrEqual(RELEARN_MS - 1000);
    expect(Date.parse(body.due) - before).toBeLessThan(RELEARN_MS + 5000);
  });

  it("409s a review that lost a race, 404s unknown or foreign cards, 400s bad grades", async () => {
    mocks.cardUpdate.mockResolvedValueOnce({ matchedCount: 0 });
    expect((await grade(id.toHexString(), { grade: "easy" })).status).toBe(409);
    mocks.cardFind.mockImplementation(() => ({ lean: async () => null }));
    expect((await grade(id.toHexString(), { grade: "easy" })).status).toBe(404);
    expect((await grade("not-an-id", { grade: "easy" })).status).toBe(404);
    expect((await grade(id.toHexString(), { grade: "perfect" })).status).toBe(400);
  });
});

describe("DELETE /api/flashcards/[id]", () => {
  it("deletes only the learner's own card", async () => {
    const id = new ObjectId();
    const del = (cardId: string) =>
      removeCard(new Request(`http://localhost/api/flashcards/${cardId}`, { method: "DELETE" }), {
        params: Promise.resolve({ cardId }),
      });
    mocks.cardDelete.mockResolvedValueOnce({ deletedCount: 1 });
    expect((await del(id.toHexString())).status).toBe(200);
    expect(mocks.cardDelete).toHaveBeenCalledWith({ _id: id, userId: curriculum.userId });
    mocks.cardDelete.mockResolvedValueOnce({ deletedCount: 0 });
    expect((await del(id.toHexString())).status).toBe(404);
  });
});

describe("GET /api/flashcards/export", () => {
  it("downloads the topic's cards as an Anki file, owner-scoped", async () => {
    curriculum.title = "Recursion 101";
    mocks.cardFindMany.mockImplementation(() => ({
      sort: () => ({ lean: async () => [{ lessonRef: "lesson-1", front: "Q", back: "A", createdAt: new Date() }] }),
    }));
    const res = await exportDeck(new Request(`http://localhost/api/flashcards/export?id=${curriculum._id}`));
    expect(res.status).toBe(200);
    expect(mocks.resolve).toHaveBeenCalledWith(curriculum.userId, curriculum._id.toHexString());
    expect(mocks.cardFindMany.mock.calls[0][0]).toEqual({ userId: curriculum.userId, curriculumId: curriculum._id });
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="learnpath-recursion-101.txt"');
    expect(await res.text()).toContain("\nQ\tA\tLearnPath lesson-1\n");

    mocks.resolve.mockResolvedValueOnce(null);
    expect((await exportDeck(new Request("http://localhost/api/flashcards/export?id=x"))).status).toBe(404);
  });
});
