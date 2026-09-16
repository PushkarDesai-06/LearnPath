/**
 * GET a lesson's content — non-blocking. On first open the lesson is enqueued
 * for background generation (a `generating` placeholder doc; the unique
 * (userId, curriculumId, lessonRef) index dedups concurrent opens). The actual
 * generation runs in the worker (`lib/jobs/lessonWorker.ts`).
 *
 * Response is one of:
 *   { status: "ready", lesson: {...blocks} }
 *   { status: "generating", curriculumId }
 * A failed OR content-less lesson (e.g. an old doc whose blocks came back empty)
 * is re-enqueued and reported as "generating".
 */
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth/guards";
import { lessonsCollection } from "@/lib/db/collections";
import type { LessonDoc } from "@/lib/db/models";
import { locateLesson, publicLessonBlock } from "@/lib/server/curriculumLocate";
import { isLessonReady } from "@/lib/server/lessonReady";
import { handler, json, notFound } from "@/lib/http";

export const GET = handler(
  async (_request, ctx: { params: Promise<{ lessonId: string }> }) => {
    const { lessonId } = await ctx.params;
    const user = await requireUser();

    const located = await locateLesson(user._id, lessonId);
    if (!located) throw notFound("Lesson not found");
    const { curriculum, lesson } = located;

    const lessons = await lessonsCollection();
    const filter = {
      userId: user._id,
      curriculumId: curriculum._id,
      lessonRef: lessonId,
    };

    const readyResponse = (doc: LessonDoc) =>
      json({
        status: "ready",
        lesson: {
          id: lessonId,
          curriculumId: curriculum._id.toHexString(),
          title: doc.title,
          blocks: doc.blocks.map(publicLessonBlock),
        },
      });

    let doc: LessonDoc | null = await lessons.findOne(filter).lean();
    if (isLessonReady(doc)) return readyResponse(doc!);

    // A placeholder that's still being generated (no blocks yet).
    if (doc && doc.genStatus === "generating" && doc.blocks.length === 0) {
      return json({
        status: "generating",
        curriculumId: curriculum._id.toHexString(),
      });
    }

    if (!doc) {
      // First open → enqueue by inserting the placeholder. The unique index
      // makes this the dedup point: a concurrent open hits E11000 and falls
      // through.
      try {
        await lessons.create({
          _id: new ObjectId(),
          userId: user._id,
          curriculumId: curriculum._id,
          lessonRef: lessonId,
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
        $set: {
          blocks: [],
          genStatus: "generating",
          genError: null,
          claimedAt: null,
        },
      });
    }

    // Handle the race where it became ready between the write and this read.
    doc = await lessons.findOne(filter).lean();
    if (isLessonReady(doc)) return readyResponse(doc!);
    return json({
      status: "generating",
      curriculumId: curriculum._id.toHexString(),
    });
  },
);
