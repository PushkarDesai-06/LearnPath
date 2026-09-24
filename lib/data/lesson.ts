/**
 * Lesson content for the learn page and its poller. Absorbs the former
 * `GET /api/lesson/[lessonId]`, split into a pure read (used while rendering
 * the page) and the enqueue write (used only by the route the poller hits).
 *
 * The split matters: a Server Component render may run on prefetch, and the
 * enqueue starts an LLM job — so rendering must never enqueue.
 */
import "server-only";
import { ObjectId } from "mongodb";
import { lessonsCollection } from "@/lib/db/collections";
import type { LessonDoc } from "@/lib/db/models";
import {
  locateLesson,
  publicLessonBlock,
  type LocatedLesson,
} from "@/lib/server/curriculumLocate";
import { isLessonReady } from "@/lib/server/lessonReady";
import type { LessonBlockDTO, LessonView } from "@/lib/data/types";

function readyView(doc: LessonDoc, lessonRef: string, located: LocatedLesson): LessonView {
  return {
    status: "ready",
    lesson: {
      id: lessonRef,
      curriculumId: located.curriculum._id.toHexString(),
      title: doc.title,
      blocks: doc.blocks.map(publicLessonBlock) as LessonBlockDTO[],
    },
  };
}

function filterFor(userId: ObjectId, located: LocatedLesson, lessonRef: string) {
  return { userId, curriculumId: located.curriculum._id, lessonRef };
}

/**
 * Pure read: `ready` with content, `generating` for anything not yet
 * renderable (missing, in flight, failed, or empty), or `null` if the lesson
 * isn't in one of the learner's curricula.
 */
export async function readLessonView(
  userId: string,
  lessonRef: string,
): Promise<LessonView | null> {
  const uid = new ObjectId(userId);
  const located = await locateLesson(uid, lessonRef);
  if (!located) return null;
  const lessons = await lessonsCollection();
  const doc = await lessons.findOne(filterFor(uid, located, lessonRef)).lean();
  if (isLessonReady(doc)) return readyView(doc!, lessonRef, located);
  return {
    status: "generating",
    curriculumId: located.curriculum._id.toHexString(),
  };
}

/**
 * Read, enqueueing generation when the lesson isn't renderable: on first open
 * insert a `generating` placeholder (the unique index dedups concurrent opens),
 * and re-enqueue a failed or content-less doc so old empty lessons self-heal.
 * The worker (`lib/jobs/lessonWorker.ts`) does the actual generation.
 */
export async function ensureLessonQueued(
  userId: ObjectId,
  lessonRef: string,
): Promise<LessonView | null> {
  const located = await locateLesson(userId, lessonRef);
  if (!located) return null;
  const { curriculum, lesson } = located;
  const lessons = await lessonsCollection();
  const filter = filterFor(userId, located, lessonRef);
  const generating: LessonView = {
    status: "generating",
    curriculumId: curriculum._id.toHexString(),
  };

  let doc: LessonDoc | null = await lessons.findOne(filter).lean();
  if (isLessonReady(doc)) return readyView(doc!, lessonRef, located);

  // A placeholder that's still being generated (no blocks yet).
  if (doc && doc.genStatus === "generating" && doc.blocks.length === 0) {
    return generating;
  }

  if (!doc) {
    // First open → enqueue. A concurrent open hits E11000 and falls through.
    try {
      await lessons.create({
        _id: new ObjectId(),
        userId,
        curriculumId: curriculum._id,
        lessonRef,
        title: lesson.title,
        blocks: [],
        generatedAt: new Date(),
        model: "",
        genStatus: "generating",
        claimedAt: null,
      });
    } catch (err) {
      if ((err as { code?: number })?.code !== 11000) throw err;
    }
  } else {
    // Doc exists but failed, or "ready" with empty/broken blocks → regenerate.
    await lessons.updateOne(filter, {
      $set: { blocks: [], genStatus: "generating", genError: null, claimedAt: null },
    });
  }

  // Handle the race where it became ready between the write and this read.
  doc = await lessons.findOne(filter).lean();
  if (isLessonReady(doc)) return readyView(doc!, lessonRef, located);
  return generating;
}
