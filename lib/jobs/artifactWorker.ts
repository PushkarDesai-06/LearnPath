/**
 * Background artifact worker — the second generation pass for `interactive`
 * lesson blocks.
 *
 * The lesson worker saves a lesson with `artifactsStatus: "pending"` when it
 * contains an interactive block (a `spec`, no HTML yet). The lesson is already
 * readable; this worker claims such lessons, has the artifact agent write each
 * pending block's HTML, and marks the block `ready` or `failed`. An artifact is
 * optional, so a failure only affects its own block — never the lesson.
 *
 * Same properties as the lesson worker: atomic claims guarded by a token, a
 * stale-claim reaper for restarts, and an attempt cap. There are no automatic
 * retries of a block that failed; the page simply hides it.
 */
import { randomUUID } from "node:crypto";
import { lessonsCollection } from "@/lib/db/collections";
import type { LessonBlock, LessonDoc } from "@/lib/db/models";
import { runArtifactAgent } from "@/lib/ai/agents/artifact";
import { locateLesson } from "@/lib/server/curriculumLocate";
import { createJobPump } from "@/lib/jobs/pump";
import { MAX_LESSON_ATTEMPTS } from "@/lib/jobs/lessonPolicy";
import { loadLearnerContext } from "@/lib/jobs/learnerContext";

// One at a time: artifacts are a nice-to-have and must not starve lessons.
const CONCURRENCY = 1;
const POLL_MS = 3000;
const STALE_MS = 5 * 60 * 1000;

let started = false;
const tick = createJobPump({
  concurrency: CONCURRENCY,
  claim: claimNextArtifact,
  run: generateArtifacts,
  onError: (error) => console.error("[artifacts] job error:", error),
});

export function startArtifactWorker(): void {
  if (started) return;
  started = true;
  console.log("[artifacts] artifact worker started (concurrency=%d)", CONCURRENCY);
  setInterval(() => {
    void tick();
  }, POLL_MS);
}

/** The markdown of the nearest text-like block before `index`, for context. */
export function precedingText(blocks: LessonBlock[], index: number): string | undefined {
  for (let i = index - 1; i >= 0; i--) {
    if (blocks[i].markdown) return blocks[i].markdown;
  }
  return undefined;
}

/** Atomically claim the oldest lesson whose artifacts are pending. */
export async function claimNextArtifact(): Promise<LessonDoc | null> {
  const lessons = await lessonsCollection();
  const staleBefore = new Date(Date.now() - STALE_MS);
  const unclaimed = { $or: [{ artifactClaimedAt: null }, { artifactClaimedAt: { $lt: staleBefore } }] };

  // Out of attempts (the process kept dying mid-run): give up on the blocks.
  await lessons.updateMany(
    { artifactsStatus: "pending", artifactAttempts: { $gte: MAX_LESSON_ATTEMPTS }, ...unclaimed },
    {
      $set: {
        "blocks.$[b].artifactStatus": "failed",
        "blocks.$[b].artifactError": "Generation timed out",
        artifactsStatus: "done",
        artifactClaimedAt: null,
        artifactClaimToken: null,
      },
    },
    { arrayFilters: [{ "b.artifactStatus": "pending" }] },
  );

  const doc = await lessons
    .findOneAndUpdate(
      {
        artifactsStatus: "pending",
        $and: [
          unclaimed,
          { $or: [{ artifactAttempts: { $lt: MAX_LESSON_ATTEMPTS } }, { artifactAttempts: { $exists: false } }] },
        ],
      },
      { $set: { artifactClaimedAt: new Date(), artifactClaimToken: randomUUID() }, $inc: { artifactAttempts: 1 } },
      { sort: { generatedAt: 1 }, returnDocument: "after" },
    )
    .lean();
  return (doc as LessonDoc | null) ?? null;
}

export async function generateArtifacts(doc: LessonDoc): Promise<void> {
  const lessons = await lessonsCollection();
  const owned = { _id: doc._id, artifactClaimToken: doc.artifactClaimToken };

  const setBlock = async (blockId: string, fields: Partial<LessonBlock>) => {
    const $set = Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [`blocks.$[b].${k}`, v]),
    );
    const res = await lessons.updateOne(owned, { $set }, { arrayFilters: [{ "b.blockId": blockId }] });
    return res.matchedCount > 0;
  };

  const pending = doc.blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.kind === "interactive" && block.artifactStatus === "pending" && block.blockId);

  const located = await locateLesson(doc.userId, doc.lessonRef);
  for (const { block, index } of pending) {
    const blockId = block.blockId!;
    try {
      if (!located) throw new Error("Lesson no longer exists in any curriculum");
      if (!block.spec?.trim()) throw new Error("Interactive block has no spec");
      const learner = await loadLearnerContext(located.curriculum, located.lesson);

      console.log("[artifacts] building:", block.caption ?? blockId);
      const html = await runArtifactAgent({
        lessonTitle: located.lesson.title,
        objectives: located.lesson.objectives,
        ...learner,
        title: block.caption ?? located.lesson.title,
        spec: block.spec,
        context: precedingText(doc.blocks, index),
      });
      if (!(await setBlock(blockId, { artifactStatus: "ready", artifactHtml: html }))) return; // claim lost
      console.log("[artifacts] ready:", block.caption ?? blockId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[artifacts] failed:", doc.lessonRef, blockId, message);
      if (!(await setBlock(blockId, { artifactStatus: "failed", artifactError: message }))) return;
    }
  }

  await lessons.updateOne(owned, {
    $set: { artifactsStatus: "done", artifactClaimedAt: null, artifactClaimToken: null },
  });
}
