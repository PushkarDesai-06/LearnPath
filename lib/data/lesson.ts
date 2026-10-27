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
import { lessonRetryState } from "@/lib/jobs/lessonPolicy";
import { conflict } from "@/lib/http";
import { requireLessonAccess } from "@/lib/server/lessonAccess";

function failedView(doc: LessonDoc): LessonView {
  return { status: "failed", curriculumId: doc.curriculumId.toHexString(),
    message: "We couldn't prepare this lesson.", ...lessonRetryState(doc) };
}

function readyView(doc: LessonDoc, lessonRef: string, located: LocatedLesson): LessonView {
  return {
    status: "ready",
    lesson: {
      id: lessonRef,
      curriculumId: located.curriculum._id.toHexString(),
      title: doc.title,
      blocks: doc.blocks.map((block) => ({
        ...publicLessonBlock(block),
        ...(block.kind === "practice" ? {
          attempted: !!located.lesson.practiceAttempts?.some((a) => a.questionId === block.questionId),
        } : {}),
      })) as LessonBlockDTO[],
    },
  };
}

function filterFor(userId: ObjectId, located: LocatedLesson, lessonRef: string) {
  return { userId, curriculumId: located.curriculum._id, lessonRef };
}

/**
 * Pure read: content, generation progress, or a persisted failure. Returns null
 * if the lesson is not in one of the learner's curricula.
 */
export async function readLessonView(
  userId: string,
  lessonRef: string,
): Promise<LessonView | null> {
  const uid = new ObjectId(userId);
  const located = await locateLesson(uid, lessonRef);
  if (!located) return null;
  if (located.module.status === "locked") {
    return { status: "locked", curriculumId: located.curriculum._id.toHexString() };
  }
  const lessons = await lessonsCollection();
  const doc = await lessons.findOne(filterFor(uid, located, lessonRef)).lean();
  if (isLessonReady(doc)) return readyView(doc!, lessonRef, located);
  if (doc?.genStatus === "failed") return failedView(doc);
  return {
    status: "generating",
    curriculumId: located.curriculum._id.toHexString(),
  };
}

/**
 * Read, enqueueing generation when the lesson isn't renderable: on first open
 * insert a `generating` placeholder (the unique index dedups concurrent opens),
 * and repair content-less legacy docs. Failed jobs require an explicit retry.
 * The worker (`lib/jobs/lessonWorker.ts`) does the actual generation.
 */
export async function ensureLessonQueued(
  userId: ObjectId,
  lessonRef: string,
  retry = false,
): Promise<LessonView | null> {
  const located = await locateLesson(userId, lessonRef);
  if (!located) return null;
  const { curriculum, lesson } = located;
  requireLessonAccess(curriculum, lessonRef);
  const lessons = await lessonsCollection();
  const filter = filterFor(userId, located, lessonRef);
  const generating: LessonView = {
    status: "generating",
    curriculumId: curriculum._id.toHexString(),
  };

  let doc: LessonDoc | null = await lessons.findOne(filter).lean();
  if (isLessonReady(doc)) return readyView(doc!, lessonRef, located);

  if (doc?.genStatus === "failed") {
    if (!retry) return failedView(doc);
    const state = lessonRetryState(doc);
    if (!state.canRetry) throw conflict("This lesson could not be prepared after several attempts. Please return to your path.");
    if (state.retryAfterMs > 0) throw conflict("Please wait a moment before trying again.");
  }

  // A placeholder that's still being generated (no blocks yet).
  if (doc && doc.genStatus === "generating") {
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
    await lessons.updateOne({ ...filter, genStatus: doc.genStatus, generatedAt: doc.generatedAt }, {
      $set: {
        blocks: [], genStatus: "generating", genError: null, claimedAt: null, claimToken: null,
        // Old failed documents predate the attempts counter; count that failure.
        generationAttempts: doc.generationAttempts ?? (doc.genStatus === "failed" ? 1 : 0),
      },
    });
  }

  // Handle the race where it became ready between the write and this read.
  doc = await lessons.findOne(filter).lean();
  if (isLessonReady(doc)) return readyView(doc!, lessonRef, located);
  return generating;
}

/**
 * A ready interactive block's artifact HTML, for the sandboxed artifact route.
 * Same ownership and module-access rules as the lesson itself; null when the
 * lesson or block doesn't exist or the artifact isn't written.
 */
export async function readLessonArtifact(
  userId: ObjectId,
  lessonRef: string,
  blockId: string,
): Promise<{ html: string; title: string } | null> {
  const located = await locateLesson(userId, lessonRef);
  if (!located) return null;
  requireLessonAccess(located.curriculum, lessonRef);
  const lessons = await lessonsCollection();
  const doc = await lessons.findOne(filterFor(userId, located, lessonRef)).lean();
  const block = doc?.blocks.find((b) => b.kind === "interactive" && b.blockId === blockId);
  if (!block || block.artifactStatus !== "ready" || !block.artifactHtml) return null;
  return { html: block.artifactHtml, title: block.caption ?? doc!.title };
}
