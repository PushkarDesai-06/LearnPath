import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { curriculaCollection, progressEventsCollection } from "@/lib/db/collections";
import { recordPractice } from "@/lib/server/practiceProgress";
import { completeLesson } from "@/lib/server/completeLesson";
import { curriculumFixture } from "../helpers/curriculum";

// Explicit opt-in; never load .env.local or connect to the application's DB.
const uri = process.env.RELIABILITY_TEST_DB_URI;
describe.skipIf(!uri)("progress writes against MongoDB", () => {
  beforeAll(async () => {
    vi.stubEnv("MONGODB_URI", uri!);
    vi.stubEnv("MONGODB_DB", `learnpath_test_${randomUUID().replaceAll("-", "")}`);
    const curricula = await curriculaCollection();
    await curricula.init();
    const events = await progressEventsCollection();
    await events.init();
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
});
