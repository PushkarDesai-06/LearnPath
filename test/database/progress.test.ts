import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { assessmentsCollection, curriculaCollection, lessonsCollection, progressEventsCollection } from "@/lib/db/collections";
import { recordPractice } from "@/lib/server/practiceProgress";
import { completeLesson } from "@/lib/server/completeLesson";
import { curriculumFixture } from "../helpers/curriculum";
import { ensureLessonQueued } from "@/lib/data/lesson";
import { claimNext, generate } from "@/lib/jobs/lessonWorker";
import { generateCurriculum } from "@/lib/server/curriculumGeneration";
import type { AssessmentDoc } from "@/lib/db/models";
import type { CurriculumOutput } from "@/lib/ai/schemas";

const ai = vi.hoisted(() => ({ lesson: vi.fn(), curriculum: vi.fn() }));
vi.mock("@/lib/ai/agents/lesson", () => ({ runLessonAgent: ai.lesson }));
vi.mock("@/lib/ai/agents/curriculum", () => ({ runCurriculumAgent: ai.curriculum }));
vi.mock("@/lib/ai/provider", () => ({ modelName: () => "test" }));

// Explicit opt-in; never load .env.local or connect to the application's DB.
const uri = process.env.RELIABILITY_TEST_DB_URI;
const authored: CurriculumOutput = { title: "Selected topic", modules: [{
  title: "Basics", summary: "Foundations", prerequisites: [], lessons: [{
    title: "Start here", objectives: ["Understand basics"], estMinutes: 10,
    difficultyLevel: "beginner", topics: ["basics"],
  }],
}] };
function assessmentFixture(): AssessmentDoc {
  return { _id: new ObjectId(), userId: new ObjectId(), onboardingId: new ObjectId(),
    domain: "Programming", refinedTopic: "Selected topic", state: "complete", levels: [],
    rounds: 1, questions: [], result: { estimatedLevel: "beginner", score: 0.5,
      perTopicMastery: [], strengths: [], gaps: [] }, createdAt: new Date(), updatedAt: new Date() };
}
describe.skipIf(!uri)("progress writes against MongoDB", () => {
  beforeAll(async () => {
    vi.stubEnv("MONGODB_URI", uri!);
    vi.stubEnv("MONGODB_DB", `learnpath_test_${randomUUID().replaceAll("-", "")}`);
    const curricula = await curriculaCollection();
    await curricula.init();
    const events = await progressEventsCollection();
    await events.init();
    const lessons = await lessonsCollection();
    await lessons.init();
  }, 15000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    vi.unstubAllEnvs();
  });

  it("atomically deduplicates simultaneous first attempts and event writes", async () => {
    const curricula = await curriculaCollection();
    const doc = curriculumFixture();
    await curricula.create(doc);
    const request = { userId: doc.userId, curriculumId: doc._id, lessonId: "lesson-1",
      questionId: "q1", correct: true, outcome: 1, countsTowardMastery: true };
    const results = await Promise.all(Array.from({ length: 5 }, () => recordPractice(request)));
    expect(results.filter((r) => r.counted)).toHaveLength(1);
    const saved = await curricula.findById(doc._id).lean();
    expect(saved!.modules[0].lessons[0].masteryScore).toBe(0.5);
    expect(saved!.modules[0].lessons[0].practiceAttempts).toHaveLength(1);
    const events = await progressEventsCollection();
    expect(await events.countDocuments({ curriculumId: doc._id, type: "practice_answered" })).toBe(1);
  });

  it("keeps distinct concurrent attempts and one completion receipt on a legacy document", async () => {
    const curricula = await curriculaCollection();
    const doc = curriculumFixture();
    delete doc.revision;
    await curricula.collection.insertOne(doc);
    await Promise.all(["q1", "q2", "q3"].map((questionId) => recordPractice({
      userId: doc.userId, curriculumId: doc._id, lessonId: "lesson-1", questionId,
      correct: true, outcome: 1, countsTowardMastery: true,
    })));
    await Promise.all([1, 2].map(() => completeLesson({
      userId: doc.userId, curriculumId: doc._id, lessonRef: "lesson-1", timeSpentMs: 1000,
    })));
    const saved = await curricula.findById(doc._id).lean();
    expect(saved!.modules[0].lessons[0].masteryScore).toBe(0.875);
    expect(saved!.modules[0].lessons[0].practiceAttempts).toHaveLength(3);
    const events = await progressEventsCollection();
    expect(await events.countDocuments({ curriculumId: doc._id, type: "lesson_completed" })).toBe(1);
  });

  it("leaves failed generation stopped until an explicit, bounded retry", async () => {
    const curricula = await curriculaCollection();
    const doc = curriculumFixture();
    // Lesson references are globally unique in real generated curricula.
    doc.modules[0].lessons[0].id = randomUUID();
    const ref = doc.modules[0].lessons[0].id;
    await curricula.create(doc);
    await ensureLessonQueued(doc.userId, ref);
    const claim = await claimNext();
    expect(claim!.generationAttempts).toBe(1);
    ai.lesson.mockRejectedValueOnce(new Error("provider unavailable"));
    await generate(claim!);
    expect(await ensureLessonQueued(doc.userId, ref)).toMatchObject({ status: "failed", canRetry: true });
    expect(await claimNext()).toBeNull();
    await expect(ensureLessonQueued(doc.userId, ref, true)).rejects.toMatchObject({ status: 409 });
    const lessons = await lessonsCollection();
    await lessons.updateOne({ _id: claim!._id }, { $set: { failedAt: new Date(Date.now() - 60_000) } });
    await Promise.all([ensureLessonQueued(doc.userId, ref, true), ensureLessonQueued(doc.userId, ref, true)]);
    const retry = await claimNext();
    expect(retry!.generationAttempts).toBe(2);
    expect(await claimNext()).toBeNull();
    await lessons.updateOne({ _id: claim!._id }, { $set: { genStatus: "failed", generationAttempts: 3 } });
    await expect(ensureLessonQueued(doc.userId, ref, true)).rejects.toMatchObject({ status: 409 });
  });

  it("rejects results from an expired worker claim", async () => {
    const curricula = await curriculaCollection();
    const doc = curriculumFixture();
    doc.modules[0].lessons[0].id = randomUUID();
    await curricula.create(doc);
    await ensureLessonQueued(doc.userId, doc.modules[0].lessons[0].id);
    const old = await claimNext();
    const lessons = await lessonsCollection();
    await lessons.updateOne({ _id: old!._id }, { $set: { claimedAt: new Date(Date.now() - 360_000) } });
    const current = await claimNext();
    expect(current!.claimToken).not.toBe(old!.claimToken);
    ai.lesson.mockResolvedValueOnce({ blocks: [{ kind: "text", markdown: "Stale output" }] });
    await generate(old!);
    const saved = await lessons.findById(old!._id).lean();
    expect(saved!.blocks).toEqual([]);
    expect(saved!.claimToken).toBe(current!.claimToken);
    await lessons.updateOne({ _id: old!._id }, { $set: { genStatus: "failed" } });
  });

  it("generates the selected assessment once even when another tab requests it", async () => {
    ai.curriculum.mockReset();
    const assessments = await assessmentsCollection();
    const selected = assessmentFixture();
    const newer = { ...assessmentFixture(), userId: selected.userId, refinedTopic: "Wrong topic", updatedAt: new Date(Date.now() + 1000) };
    await assessments.create([selected, newer]);
    let resolve!: (output: CurriculumOutput) => void;
    ai.curriculum.mockReturnValueOnce(new Promise<CurriculumOutput>((done) => { resolve = done; }));
    const first = generateCurriculum(selected.userId, selected._id);
    await vi.waitFor(() => expect(ai.curriculum).toHaveBeenCalledTimes(1));
    await expect(generateCurriculum(selected.userId, selected._id)).rejects.toMatchObject({ status: 409 });
    resolve(authored);
    const result = await first;
    expect(result.curriculum.assessmentId).toEqual(selected._id);
    expect(result.curriculum._id).toEqual(selected._id);
    expect(ai.curriculum.mock.calls[0][0].refinedTopic).toBe("Selected topic");
    expect((await generateCurriculum(selected.userId, selected._id)).existed).toBe(true);
    expect(ai.curriculum).toHaveBeenCalledTimes(1);
    const curricula = await curriculaCollection();
    expect(await curricula.countDocuments({ assessmentId: selected._id })).toBe(1);
  });

  it("releases failed generation claims and rejects foreign or unfinished assessments", async () => {
    ai.curriculum.mockReset();
    const assessments = await assessmentsCollection();
    const selected = assessmentFixture();
    await assessments.create(selected);
    await expect(generateCurriculum(new ObjectId(), selected._id)).rejects.toMatchObject({ status: 404 });
    ai.curriculum.mockRejectedValueOnce(new Error("provider down"));
    await expect(generateCurriculum(selected.userId, selected._id)).rejects.toThrow("provider down");
    expect((await assessments.findById(selected._id).lean())!.curriculumClaimToken).toBeNull();
    ai.curriculum.mockResolvedValueOnce(authored);
    expect((await generateCurriculum(selected.userId, selected._id)).existed).toBe(false);
    const unfinished: AssessmentDoc = { ...assessmentFixture(), state: "in_progress" };
    await assessments.create(unfinished);
    await expect(generateCurriculum(unfinished.userId, unfinished._id)).rejects.toMatchObject({ status: 400 });
  });

  it("returns a legacy curriculum with a random ID without generating another", async () => {
    ai.curriculum.mockReset();
    const selected = assessmentFixture();
    const assessments = await assessmentsCollection();
    await assessments.create(selected);
    const legacy = { ...curriculumFixture(), userId: selected.userId, assessmentId: selected._id };
    const curricula = await curriculaCollection();
    await curricula.create(legacy);
    expect((await generateCurriculum(selected.userId, selected._id)).curriculum._id).toEqual(legacy._id);
    expect(ai.curriculum).not.toHaveBeenCalled();
  });

  it("does not publish output or release another request's replacement claim", async () => {
    ai.curriculum.mockReset();
    const selected = assessmentFixture();
    const assessments = await assessmentsCollection();
    await assessments.create(selected);
    let resolve!: (output: CurriculumOutput) => void;
    ai.curriculum.mockReturnValueOnce(new Promise<CurriculumOutput>((done) => { resolve = done; }));
    const original = generateCurriculum(selected.userId, selected._id);
    const rejected = expect(original).rejects.toMatchObject({ status: 409 });
    await vi.waitFor(() => expect(ai.curriculum).toHaveBeenCalledTimes(1));
    await assessments.updateOne({ _id: selected._id }, { $set: { curriculumClaimToken: "replacement" } });
    resolve(authored);
    await rejected;
    expect((await assessments.findById(selected._id).lean())!.curriculumClaimToken).toBe("replacement");
    const curricula = await curriculaCollection();
    expect(await curricula.countDocuments({ assessmentId: selected._id })).toBe(0);
  });
});
