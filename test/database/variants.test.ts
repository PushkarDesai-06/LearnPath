/**
 * Block variants against a real MongoDB: the unique index is what keeps
 * concurrent requests from running the agent twice, and a claim token is what
 * lets an abandoned request be taken over safely.
 */
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  blockVariantsCollection,
  curriculaCollection,
  lessonsCollection,
  progressEventsCollection,
} from "@/lib/db/collections";
import { requestBlockVariant } from "@/lib/server/blockVariant";
import { VARIANT_DAILY_LIMIT, VARIANT_STALE_MS } from "@/lib/domain/variants";
import { curriculumFixture } from "../helpers/curriculum";

const ai = vi.hoisted(() => ({ variant: vi.fn() }));
vi.mock("@/lib/ai/agents/variant", () => ({ runVariantAgent: ai.variant }));
vi.mock("@/lib/ai/agents/artifact", () => ({ runArtifactAgent: vi.fn() }));
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

describe.skipIf(!uri)("block variants against MongoDB", () => {
  beforeAll(async () => {
    vi.stubEnv("MONGODB_URI", uri!);
    vi.stubEnv("MONGODB_DB", `learnpath_test_${randomUUID().replaceAll("-", "")}`);
    for (const collection of [curriculaCollection, lessonsCollection, progressEventsCollection, blockVariantsCollection]) {
      await (await collection()).init();
    }
  }, 15000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    vi.unstubAllEnvs();
  });

  it("runs the agent once for simultaneous requests and returns the same rewrite after", async () => {
    const { userId, curriculumId, lessonRef } = await seedLesson();
    ai.variant.mockReset();
    ai.variant.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 100));
      return "Plainer words.";
    });
    const request = { userId, lessonRef, blockKey: "b1", style: "simpler" as const };
    const results = await Promise.all(Array.from({ length: 5 }, () => requestBlockVariant(request)));

    expect(ai.variant).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.status === "ready")).toHaveLength(1);
    expect(results.filter((r) => r.status === "generating")).toHaveLength(4);
    expect(await requestBlockVariant(request)).toEqual({ status: "ready", style: "simpler", markdown: "Plainer words." });
    expect(ai.variant).toHaveBeenCalledTimes(1);

    const variants = await blockVariantsCollection();
    expect(await variants.countDocuments({ userId, curriculumId })).toBe(1);
    const events = await progressEventsCollection();
    expect(await events.countDocuments({ userId, type: "block_variant_requested" })).toBe(1);
  });

  it("takes over an abandoned claim and fences the old request's late write", async () => {
    const { userId, curriculumId, lessonRef } = await seedLesson();
    const variants = await blockVariantsCollection();
    const old = new Date(Date.now() - VARIANT_STALE_MS - 1000);
    await variants.create({
      _id: new ObjectId(), userId, curriculumId, lessonRef, blockKey: "b1", style: "analogy",
      status: "generating", claimToken: "dead-request", claimedAt: old, attempts: 1, createdAt: old, updatedAt: old,
    });
    ai.variant.mockReset();
    ai.variant.mockResolvedValue("A new analogy.");

    const result = await requestBlockVariant({ userId, lessonRef, blockKey: "b1", style: "analogy" });
    expect(result).toEqual({ status: "ready", style: "analogy", markdown: "A new analogy." });

    // The dead request finally answers: its token no longer owns the record.
    const late = await variants.updateOne({ userId, style: "analogy", claimToken: "dead-request" }, { $set: { markdown: "stale" } });
    expect(late.matchedCount).toBe(0);
    const saved = await variants.findOne({ userId, style: "analogy" }).lean();
    expect(saved).toMatchObject({ status: "ready", markdown: "A new analogy.", attempts: 2, claimToken: null });
  });

  it("lets exactly one of several parallel requests take the last rewrite of the day", async () => {
    const { userId, curriculumId, lessonRef } = await seedLesson();
    const variants = await blockVariantsCollection();
    const now = new Date();
    await variants.insertMany(Array.from({ length: VARIANT_DAILY_LIMIT - 1 }, (_, i) => ({
      _id: new ObjectId(), userId, curriculumId, lessonRef, blockKey: `used-${i}`, style: "simpler",
      status: "ready", markdown: "m", attempts: 1, createdAt: now, updatedAt: now,
    })));
    ai.variant.mockReset();
    ai.variant.mockResolvedValue("Rewritten.");

    const styles = ["simpler", "analogy", "example"] as const;
    const results = await Promise.allSettled(
      styles.map((style) => requestBlockVariant({ userId, lessonRef, blockKey: "b1", style })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const refused = results.filter((r) => r.status === "rejected");
    expect(refused).toHaveLength(2);
    for (const r of refused) expect((r as PromiseRejectedResult).reason).toMatchObject({ status: 429 });
    expect(ai.variant).toHaveBeenCalledTimes(1);
    // Refused reservations are rolled back, so the learner sits exactly at the limit.
    expect(await variants.countDocuments({ userId })).toBe(VARIANT_DAILY_LIMIT);
  });

  it("refuses new rewrites past the daily limit but still serves stored ones", async () => {
    const { userId, curriculumId, lessonRef } = await seedLesson();
    const variants = await blockVariantsCollection();
    const now = new Date();
    await variants.insertMany(Array.from({ length: VARIANT_DAILY_LIMIT }, (_, i) => ({
      _id: new ObjectId(), userId, curriculumId, lessonRef, blockKey: `other-${i}`,
      style: i === 0 ? "example" : "simpler", status: "ready", markdown: `m${i}`, attempts: 1,
      createdAt: now, updatedAt: now,
    })));
    await variants.updateOne({ userId, blockKey: "other-0" }, { $set: { blockKey: "b1" } });
    ai.variant.mockReset();

    await expect(requestBlockVariant({ userId, lessonRef, blockKey: "b1", style: "simpler" }))
      .rejects.toMatchObject({ status: 429 });
    expect(await requestBlockVariant({ userId, lessonRef, blockKey: "b1", style: "example" }))
      .toMatchObject({ status: "ready", markdown: "m0" });
    expect(ai.variant).not.toHaveBeenCalled();
  });
});
