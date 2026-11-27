/**
 * Topic lifecycle against a real MongoDB: the delete cascade (including a
 * lesson job that finishes after its topic is gone), archive filtering,
 * reset, and the shell and activity reads.
 */
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  assessmentsCollection,
  blockVariantsCollection,
  chatsCollection,
  curriculaCollection,
  flashcardDecksCollection,
  flashcardsCollection,
  lessonsCollection,
  onboardingCollection,
  progressEventsCollection,
  userPrefsCollection,
} from "@/lib/db/collections";
import { deleteTopic, setTopicArchived } from "@/lib/server/topics";
import { resetLessonProgress } from "@/lib/server/lessonProgress";
import { resolveCurriculum } from "@/lib/server/curriculumLocate";
import { claimNext, generate } from "@/lib/jobs/lessonWorker";
import { claimNextArtifact, generateArtifacts } from "@/lib/jobs/artifactWorker";
import { listArchivedTopics, listTopics } from "@/lib/data/topics";
import { getShellData } from "@/lib/data/shell";
import { getActivity } from "@/lib/data/activity";
import { getDashboard } from "@/lib/data/progress";
import { mutatePrefs } from "@/lib/server/prefs";
import { curriculumFixture } from "../helpers/curriculum";

const ai = vi.hoisted(() => ({ lesson: vi.fn(), artifact: vi.fn() }));
vi.mock("@/lib/ai/agents/lesson", () => ({ runLessonAgent: ai.lesson }));
vi.mock("@/lib/ai/agents/artifact", () => ({ runArtifactAgent: ai.artifact }));
vi.mock("@/lib/ai/provider", () => ({ modelName: () => "test" }));

// Explicit opt-in; never load .env.local or connect to the application's DB.
const uri = process.env.RELIABILITY_TEST_DB_URI;

async function seedTopic() {
  const curriculum = curriculumFixture();
  const lessonRef = randomUUID();
  curriculum.modules[0].lessons[0].id = lessonRef;
  const onboardingId = new ObjectId();
  curriculum.assessmentId = new ObjectId();
  const { userId, _id: curriculumId } = curriculum;
  const scope = { userId, curriculumId };
  const now = new Date();

  await (await onboardingCollection()).create({
    _id: onboardingId, userId, rawDescription: "learn", clarity: { clearEnough: true, cycle: 1, maxCycles: 4, exchanges: [] },
    status: "learning", createdAt: now, updatedAt: now,
  });
  await (await assessmentsCollection()).create({
    _id: curriculum.assessmentId, userId, onboardingId, domain: "d", refinedTopic: "t", state: "complete",
    levels: [], rounds: 1, questions: [], createdAt: now, updatedAt: now,
  });
  await (await curriculaCollection()).create(curriculum);
  await (await lessonsCollection()).create({
    _id: new ObjectId(), ...scope, lessonRef, title: "Lesson", generatedAt: now, model: "m", genStatus: "ready",
    blocks: [{ kind: "text", blockId: "b1", markdown: "Hello" }],
  });
  await (await blockVariantsCollection()).create({
    _id: new ObjectId(), ...scope, lessonRef, blockKey: "b1", style: "simpler", status: "ready",
    attempts: 1, createdAt: now, updatedAt: now,
  });
  const deckId = new ObjectId();
  await (await flashcardDecksCollection()).create({
    _id: deckId, ...scope, lessonRef, status: "ready", attempts: 1, createdAt: now, updatedAt: now,
  });
  await (await flashcardsCollection()).create({
    _id: new ObjectId(), ...scope, lessonRef, deckId, front: "f", back: "b", due: new Date(Date.now() - 1000),
    reps: 0, intervalDays: 0, ease: 2.5, lapses: 0, reviewCount: 0, createdAt: now, updatedAt: now,
  });
  await (await chatsCollection()).create({
    _id: new ObjectId(), ...scope, title: "chat", messages: [], createdAt: now, updatedAt: now,
  });
  await (await progressEventsCollection()).create([
    { _id: new ObjectId(), ...scope, lessonRef, type: "lesson_completed", at: now },
    { _id: new ObjectId(), ...scope, lessonRef, type: "practice_answered", correct: true, at: now },
  ]);
  await mutatePrefs(userId, () => ({
    value: null,
    changes: {
      pinnedLessons: [{ curriculumId, lessonId: lessonRef, at: now }],
      recentLessons: [{ curriculumId, lessonId: lessonRef, at: now }],
    },
  }));
  return { ...scope, lessonRef, assessmentId: curriculum.assessmentId, onboardingId, curriculum };
}

const scopeOf = (t: { userId: ObjectId; curriculumId: ObjectId }) => ({ userId: t.userId, curriculumId: t.curriculumId });

const counts = async (topic: { userId: ObjectId; curriculumId: ObjectId }) => {
  const scope = scopeOf(topic);
  return Promise.all([
    curriculaCollection().then((c) => c.countDocuments({ _id: scope.curriculumId })),
    lessonsCollection().then((c) => c.countDocuments(scope)),
    blockVariantsCollection().then((c) => c.countDocuments(scope)),
    flashcardDecksCollection().then((c) => c.countDocuments(scope)),
    flashcardsCollection().then((c) => c.countDocuments(scope)),
    chatsCollection().then((c) => c.countDocuments(scope)),
    progressEventsCollection().then((c) => c.countDocuments(scope)),
  ]);
};

describe.skipIf(!uri)("topic lifecycle against MongoDB", () => {
  beforeAll(async () => {
    vi.stubEnv("MONGODB_URI", uri!);
    vi.stubEnv("MONGODB_DB", `learnpath_test_${randomUUID().replaceAll("-", "")}`);
    for (const collection of [
      curriculaCollection, lessonsCollection, progressEventsCollection, blockVariantsCollection,
      flashcardDecksCollection, flashcardsCollection, chatsCollection, userPrefsCollection,
    ]) {
      await (await collection()).init();
    }
  }, 15000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    vi.unstubAllEnvs();
  });

  it("deletes everything tied to the topic and leaves other topics alone", async () => {
    const doomed = await seedTopic();
    const other = await seedTopic();
    await deleteTopic(doomed.userId, doomed.curriculumId);

    expect(await counts(doomed)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(await (await assessmentsCollection()).countDocuments({ _id: doomed.assessmentId })).toBe(0);
    expect(await (await onboardingCollection()).countDocuments({ _id: doomed.onboardingId })).toBe(0);
    const prefs = await (await userPrefsCollection()).findOne({ userId: doomed.userId }).lean();
    expect(prefs!.pinnedLessons).toEqual([]);
    expect(prefs!.recentLessons).toEqual([]);

    expect(await counts(other)).toEqual([1, 1, 1, 1, 1, 1, 2]);
    expect(await (await assessmentsCollection()).countDocuments({ _id: other.assessmentId })).toBe(1);
  });

  it("refuses to delete another learner's topic", async () => {
    const mine = await seedTopic();
    await expect(deleteTopic(new ObjectId(), mine.curriculumId)).rejects.toMatchObject({ status: 404 });
    expect((await counts(mine))[0]).toBe(1);
  });

  it("removes a queued lesson job and a worker that finishes afterwards recreates nothing", async () => {
    const topic = await seedTopic();
    const lessons = await lessonsCollection();
    await lessons.deleteMany(scopeOf(topic));
    const ref = topic.curriculum.modules[0].lessons[0].id;
    await lessons.create({
      _id: new ObjectId(), ...scopeOf(topic), lessonRef: ref, title: "Queued", blocks: [], generatedAt: new Date(),
      model: "", genStatus: "generating", claimedAt: null, claimToken: null, generationAttempts: 0,
    });
    const claimed = await claimNext();
    expect(claimed!.lessonRef).toBe(ref);

    let finish!: () => void;
    ai.lesson.mockReturnValueOnce(new Promise((done) => {
      finish = () => done({ blocks: [{ kind: "text", markdown: "Late output" }] });
    }));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const running = generate(claimed!);
    await vi.waitFor(() => expect(ai.lesson).toHaveBeenCalled());

    await deleteTopic(topic.userId, topic.curriculumId);
    finish();
    await running;

    expect(await counts(topic)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(await claimNext()).toBeNull();
    expect(quiet).not.toHaveBeenCalled();
    quiet.mockRestore();
  });

  it("drops an artifact job whose lesson was deleted without logging an error", async () => {
    const topic = await seedTopic();
    const lessons = await lessonsCollection();
    await lessons.updateOne(
      { ...scopeOf(topic), lessonRef: topic.lessonRef },
      { $set: {
        blocks: [{ kind: "interactive", blockId: "i1", spec: "spec", artifactStatus: "pending" }],
        artifactsStatus: "pending", artifactAttempts: 0, artifactClaimedAt: null,
      } },
    );
    const claimed = await claimNextArtifact();
    expect(claimed).not.toBeNull();
    await deleteTopic(topic.userId, topic.curriculumId);

    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await generateArtifacts(claimed!);
    expect(quiet).not.toHaveBeenCalled();
    expect(await lessons.countDocuments(scopeOf(topic))).toBe(0);
    quiet.mockRestore();
  });

  it("hides archived topics from lists and the default fallback, but not an explicit id", async () => {
    const older = await seedTopic();
    const newer = { ...(await seedTopic()) };
    // Same learner for both so the fallback has a choice.
    const curricula = await curriculaCollection();
    await curricula.updateOne({ _id: newer.curriculumId }, { $set: { userId: older.userId, createdAt: new Date(Date.now() + 5000) } });

    const uid = older.userId.toHexString();
    expect((await resolveCurriculum(older.userId))!._id.equals(newer.curriculumId)).toBe(true);
    await setTopicArchived(older.userId, newer.curriculumId, true);

    expect((await resolveCurriculum(older.userId))!._id.equals(older.curriculumId)).toBe(true);
    expect((await resolveCurriculum(older.userId, newer.curriculumId.toHexString()))!._id.equals(newer.curriculumId)).toBe(true);
    expect((await listTopics(uid)).map((t) => t.id)).toEqual([older.curriculumId.toHexString()]);
    const archived = await listArchivedTopics(uid);
    expect(archived.map((t) => t.id)).toEqual([newer.curriculumId.toHexString()]);
    expect(archived[0].archivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const shell = await getShellData(uid);
    expect(shell.topics.map((t) => t.id)).toEqual([older.curriculumId.toHexString()]);
    expect(shell.archivedTopics.map((t) => t.id)).toEqual([newer.curriculumId.toHexString()]);

    await setTopicArchived(older.userId, newer.curriculumId, false);
    expect((await listTopics(uid)).map((t) => t.id)).toEqual([
      newer.curriculumId.toHexString(), older.curriculumId.toHexString(),
    ]);
  });

  it("builds the shell with gated statuses, due cards and only pins that still resolve", async () => {
    const topic = await seedTopic();
    await mutatePrefs(topic.userId, (prefs) => ({
      value: null,
      changes: {
        pinnedLessons: [
          ...prefs.pinnedLessons,
          { curriculumId: topic.curriculumId, lessonId: "ghost-lesson", at: new Date() },
          { curriculumId: new ObjectId(), lessonId: topic.lessonRef, at: new Date() },
        ],
      },
    }));
    const shell = await getShellData(topic.userId.toHexString());
    expect(shell.dueCardsTotal).toBe(1);
    expect(shell.topics[0]).toMatchObject({ id: topic.curriculumId.toHexString(), dueCards: 1 });
    expect(shell.topics[0].modules[0].lessons[0]).toMatchObject({ id: topic.lessonRef, status: "available" });
    expect(shell.pins).toEqual([
      expect.objectContaining({ lessonId: topic.lessonRef, topicTitle: "Topic", moduleTitle: "Basics" }),
    ]);
    expect(shell.recents).toHaveLength(1);
    expect(shell.prefs).toMatchObject({ focusLessons: false, dashboard: { groupBy: "module" } });
  });

  it("reports activity days, streaks and the peek fields from real events", async () => {
    const topic = await seedTopic();
    const events = await progressEventsCollection();
    const day = (n: number) => new Date(Date.now() - n * 86_400_000);
    await events.create([
      { _id: new ObjectId(), ...scopeOf(topic), lessonRef: topic.lessonRef, type: "lesson_started", at: day(0) },
      { _id: new ObjectId(), ...scopeOf(topic), lessonRef: topic.lessonRef, type: "practice_answered", at: day(1) },
    ]);
    const activity = await getActivity(topic.userId.toHexString(), topic.curriculumId.toHexString(), "UTC");
    expect(activity.days).toHaveLength(84);
    const counted = activity.days.reduce((sum, d) => sum + d.total, 0);
    expect(counted).toBe(3); // seeded completion + answer, plus the extra answer; lesson_started is ignored
    expect(activity.currentStreak).toBeGreaterThanOrEqual(1);

    const curricula = await curriculaCollection();
    const at = new Date("2026-01-02T03:04:05.000Z");
    await curricula.updateOne(
      { _id: topic.curriculumId },
      { $set: {
        "modules.0.lessons.0.objectives": ["Understand it"],
        "modules.0.lessons.0.completion": { at },
        "modules.0.lessons.0.practiceAttempts": [{ questionId: "q", correct: true, score: 0.5, at: new Date("2026-01-01T00:00:00Z") }],
      } },
    );
    const dash = await getDashboard(topic.userId.toHexString(), topic.curriculumId.toHexString());
    if (!dash.hasCurriculum) throw new Error("expected a curriculum");
    expect(dash.modules[0].lessons[0]).toMatchObject({
      objectives: ["Understand it"],
      lastPracticedAt: at.toISOString(),
    });
  });

  it("resets one lesson without deleting its written content", async () => {
    const topic = await seedTopic();
    const curricula = await curriculaCollection();
    await curricula.updateOne(
      { _id: topic.curriculumId },
      { $set: {
        "modules.0.lessons.0.masteryScore": 0.9,
        "modules.0.lessons.0.status": "mastered",
        "modules.0.lessons.0.completion": { at: new Date() },
        "modules.0.lessons.0.practiceAttempts": [{ questionId: "q", correct: true, score: 0.9, at: new Date() }],
      } },
    );
    const before = (await curricula.findById(topic.curriculumId).lean())!;
    const result = await resetLessonProgress(topic.userId, topic.lessonRef);
    expect(result).toMatchObject({ status: "available", masteryScore: 0 });

    const saved = (await curricula.findById(topic.curriculumId).lean())!;
    const lesson = saved.modules[0].lessons[0];
    expect(lesson.masteryScore).toBe(0);
    expect(lesson.completion).toBeUndefined();
    expect(lesson.practiceAttempts).toBeUndefined();
    expect(saved.revision).toBe((before.revision ?? 0) + 1);
    expect(await (await lessonsCollection()).countDocuments({ ...scopeOf(topic), lessonRef: topic.lessonRef })).toBe(1);
  });
});
