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
 *  - Dedup: only one `generating` doc per lesson, so only one generation runs.
 *  - Concurrency cap: at most CONCURRENCY generations at once.
 *  - Reaper: a doc claimed but never finished (server died mid-run) is re-claimed
 *    once its `claimedAt` goes stale, so work survives restarts.
 */
import { randomUUID } from "node:crypto";
import {
  assessmentsCollection,
  curriculaCollection,
  lessonsCollection,
  progressEventsCollection,
} from "@/lib/db/collections";
import type { LessonBlock, LessonDoc } from "@/lib/db/models";
import { runLessonAgent } from "@/lib/ai/agents/lesson";
import { modelName } from "@/lib/ai/provider";
import { locateLesson } from "@/lib/server/curriculumLocate";
import { ObjectId } from "mongodb";

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

let started = false;
let active = 0;

export function startLessonWorker(): void {
  if (started) return;
  started = true;
  console.log("[worker] lesson worker started (concurrency=%d)", CONCURRENCY);
  setInterval(() => {
    void tick();
  }, POLL_MS);
}

async function tick(): Promise<void> {
  try {
    while (active < CONCURRENCY) {
      const lesson = await claimNext();
      if (!lesson) break;
      active += 1;
      void generate(lesson).finally(() => {
        active -= 1;
      });
    }
  } catch (err) {
    console.error("[worker] tick error:", err);
  }
}

/** Atomically claim the oldest unclaimed (or stale-claimed) generating lesson. */
async function claimNext(): Promise<LessonDoc | null> {
  const lessons = await lessonsCollection();
  const staleBefore = new Date(Date.now() - STALE_MS);
  const doc = await lessons
    .findOneAndUpdate(
      {
        genStatus: "generating",
        $or: [{ claimedAt: null }, { claimedAt: { $lt: staleBefore } }],
      },
      { $set: { claimedAt: new Date() } },
      { sort: { generatedAt: 1 }, returnDocument: "after" },
    )
    .lean();
  return (doc as LessonDoc | null) ?? null;
}

async function generate(doc: LessonDoc): Promise<void> {
  const lessons = await lessonsCollection();
  try {
    const located = await locateLesson(doc.userId, doc.lessonRef);
    if (!located) throw new Error("Lesson no longer exists in any curriculum");
    const { curriculum, lesson } = located;

    const assessments = await assessmentsCollection();
    const assessment = await assessments
      .findOne({ _id: curriculum.assessmentId })
      .lean();
    const learnerLevel =
      assessment?.result?.estimatedLevel ?? lesson.difficultyLevel;

    console.log("[worker] generating lesson:", lesson.title);
    const content = await runLessonAgent({
      lessonTitle: lesson.title,
      objectives: lesson.objectives,
      topics: lesson.topics,
      difficultyLevel: lesson.difficultyLevel,
      learnerLevel,
    });

    const blocks: LessonBlock[] = content.blocks.map((b) => {
      const clean = stripNullFields(b);
      return clean.kind === "practice"
        ? { ...clean, questionId: randomUUID() }
        : clean;
    });

    await lessons.updateOne(
      { _id: doc._id },
      {
        $set: {
          blocks,
          genStatus: "ready",
          genError: null,
          model: modelName(),
          generatedAt: new Date(),
          claimedAt: null,
        },
      },
    );

    // Side effects (same as the old synchronous route): mark generated, flip
    // available -> in_progress, log the start event.
    const curricula = await curriculaCollection();
    await curricula.collection.updateOne(
      { _id: curriculum._id },
      {
        $set: {
          "modules.$[].lessons.$[l].contentGenerated": true,
          updatedAt: new Date(),
        },
      },
      { arrayFilters: [{ "l.id": doc.lessonRef }] },
    );
    await curricula.collection.updateOne(
      { _id: curriculum._id },
      { $set: { "modules.$[].lessons.$[l].status": "in_progress" } },
      { arrayFilters: [{ "l.id": doc.lessonRef, "l.status": "available" }] },
    );

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
      { _id: doc._id },
      { $set: { genStatus: "failed", genError: message, claimedAt: null } },
    );
  }
}
