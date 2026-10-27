/**
 * Background lesson-content worker.
 *
 * Lessons are generated off the request path. A lesson doc is created in
 * `genStatus: "generating"` the moment a lesson is first opened (the unique
 * (userId, curriculumId, lessonRef) index makes that the dedup point). This
 * worker — started once on server boot via instrumentation.ts — claims those
 * docs atomically, runs the lesson agent, and writes the result.
 *
 * Properties:
 *  - Dedup: one job per lesson; only the current worker claim may save results.
 *  - Concurrency cap: at most CONCURRENCY generations per process.
 *  - Reaper: a doc claimed but never finished (server died mid-run) is re-claimed
 *    once its `claimedAt` goes stale, so work survives restarts.
 */
import { randomUUID } from "node:crypto";
import { lessonsCollection, progressEventsCollection } from "@/lib/db/collections";
import type { LessonBlock, LessonDoc } from "@/lib/db/models";
import { runLessonAgent } from "@/lib/ai/agents/lesson";
import { modelName } from "@/lib/ai/provider";
import { locateLesson } from "@/lib/server/curriculumLocate";
import { mutateCurriculum } from "@/lib/server/curriculumMutation";
import { ObjectId } from "mongodb";
import { createJobPump } from "@/lib/jobs/pump";
import { MAX_LESSON_ATTEMPTS } from "@/lib/jobs/lessonPolicy";
import { loadLearnerContext } from "@/lib/jobs/learnerContext";

const CONCURRENCY = 3;
const POLL_MS = 2000;
const STALE_MS = 5 * 60 * 1000; // re-claim a lesson stuck "claimed" this long

/**
 * The lesson agent's structured output marks per-kind fields nullish, so a block
 * may carry explicit nulls for fields its kind doesn't use. Drop those so the
 * stored block matches LessonBlock (whose optional fields are undefined, not
 * null). `kind` is never null, so the result is always a valid LessonBlock.
 */
function stripNullFields(block: Record<string, unknown>): LessonBlock {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(block)) {
    if (v !== null) out[k] = v;
  }
  return out as unknown as LessonBlock;
}

/**
 * Give practice blocks a `questionId`, every other block a `blockId` (what block
 * variants are keyed by), and the (at most one) interactive block a pending
 * artifact state. The prompt asks for one interactive block at most; extras are
 * dropped rather than failing an otherwise good lesson.
 */
export function assignBlockIds(blocks: LessonBlock[]): LessonBlock[] {
  let seenInteractive = false;
  return blocks.flatMap((b): LessonBlock[] => {
    if (b.kind === "practice") return [{ ...b, questionId: randomUUID() }];
    if (b.kind === "interactive") {
      if (seenInteractive) return [];
      seenInteractive = true;
      return [{ ...b, blockId: randomUUID(), artifactStatus: "pending" }];
    }
    return [{ ...b, blockId: randomUUID() }];
  });
}

let started = false;
const tick = createJobPump({
  concurrency: CONCURRENCY,
  claim: claimNext,
  run: generate,
  onError: (error) => console.error("[worker] job error:", error),
});

export function startLessonWorker(): void {
  if (started) return;
  started = true;
  console.log("[worker] lesson worker started (concurrency=%d)", CONCURRENCY);
  setInterval(() => {
    void tick();
  }, POLL_MS);
}

/** Atomically claim the oldest unclaimed (or stale-claimed) generating lesson. */
export async function claimNext(): Promise<LessonDoc | null> {
  const lessons = await lessonsCollection();
  const staleBefore = new Date(Date.now() - STALE_MS);
  await lessons.updateMany(
    { genStatus: "generating", generationAttempts: { $gte: MAX_LESSON_ATTEMPTS },
      $or: [{ claimedAt: null }, { claimedAt: { $lt: staleBefore } }] },
    { $set: { genStatus: "failed", genError: "Generation timed out", failedAt: new Date(), claimedAt: null, claimToken: null } },
  );
  const doc = await lessons
    .findOneAndUpdate(
      {
        genStatus: "generating",
        $and: [
          { $or: [{ claimedAt: null }, { claimedAt: { $lt: staleBefore } }] },
          { $or: [{ generationAttempts: { $lt: MAX_LESSON_ATTEMPTS } }, { generationAttempts: { $exists: false } }] },
        ],
      },
      { $set: { claimedAt: new Date(), claimToken: randomUUID() }, $inc: { generationAttempts: 1 } },
      { sort: { generatedAt: 1 }, returnDocument: "after" },
    )
    .lean();
  return (doc as LessonDoc | null) ?? null;
}

export async function generate(doc: LessonDoc): Promise<void> {
  const lessons = await lessonsCollection();
  try {
    const located = await locateLesson(doc.userId, doc.lessonRef);
    if (!located) throw new Error("Lesson no longer exists in any curriculum");
    const { curriculum, lesson } = located;

    const learner = await loadLearnerContext(curriculum, lesson);

    console.log("[worker] generating lesson:", lesson.title);
    const content = await runLessonAgent({
      lessonTitle: lesson.title,
      objectives: lesson.objectives,
      topics: lesson.topics,
      difficultyLevel: lesson.difficultyLevel,
      ...learner,
    });

    const blocks = assignBlockIds(content.blocks.map(stripNullFields));
    const hasArtifacts = blocks.some((b) => b.kind === "interactive");

    const saved = await lessons.updateOne(
      { _id: doc._id, claimToken: doc.claimToken, genStatus: "generating" },
      {
        $set: {
          blocks,
          genStatus: "ready",
          genError: null,
          model: modelName(),
          generatedAt: new Date(),
          claimedAt: null,
          claimToken: null,
          failedAt: null,
          // Hand interactive blocks to the artifact worker; the lesson is
          // readable now and the demos fill in when they're written.
          ...(hasArtifacts
            ? { artifactsStatus: "pending", artifactClaimedAt: null, artifactClaimToken: null, artifactAttempts: 0 }
            : {}),
        },
      },
    );
    if (!saved.matchedCount) return; // another worker now owns the stale claim

    // Side effects (same as the old synchronous route): mark generated, flip
    // available -> in_progress, log the start event.
    await mutateCurriculum(doc.userId, curriculum._id, (current) => {
      const target = current.modules.flatMap((m) => m.lessons).find((l) => l.id === doc.lessonRef);
      if (!target) throw new Error("Lesson no longer exists in curriculum");
      target.contentGenerated = true;
      if (target.status === "available") target.status = "in_progress";
      return { changed: true, value: undefined };
    });

    const events = await progressEventsCollection();
    await events.create({
      _id: new ObjectId(),
      userId: doc.userId,
      curriculumId: curriculum._id,
      lessonRef: doc.lessonRef,
      type: "lesson_started",
      topics: lesson.topics,
      at: new Date(),
    });

    console.log("[worker] lesson ready:", lesson.title);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] lesson generation failed:", doc.lessonRef, message);
    await lessons.updateOne(
      { _id: doc._id, claimToken: doc.claimToken, genStatus: "generating" },
      { $set: { genStatus: "failed", genError: message, failedAt: new Date(), claimedAt: null, claimToken: null } },
    );
  }
}
