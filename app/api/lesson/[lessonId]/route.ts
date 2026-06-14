/**
 * GET a lesson's content — non-blocking. On first open the lesson is enqueued
 * for background generation (a `generating` placeholder doc; the unique
 * (userId, curriculumId, lessonRef) index dedups concurrent opens). The actual
 * generation runs in the worker (`lib/jobs/lessonWorker.ts`).
 *
 * Response is one of:
 *   { status: "ready", lesson: {...blocks} }
 *   { status: "generating" }
 * A failed OR content-less lesson (e.g. an old doc whose blocks came back empty)
 * is re-enqueued and reported as "generating".
 */
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth/guards";
import { lessonsCollection } from "@/lib/db/collections";
import type { LessonBlock, LessonDoc } from "@/lib/db/models";
import { locateLesson, publicLessonBlock } from "@/lib/server/curriculumLocate";
import { handler, json, notFound } from "@/lib/http";

const nonEmpty = (v?: string) => typeof v === "string" && v.trim().length > 0;

/** A block carries real content (guards against stored empty/`{kind}`-only blocks). */
function hasRealContent(b: LessonBlock): boolean {
  return nonEmpty(b.markdown) || nonEmpty(b.code) || nonEmpty(b.prompt);
}

/** A lesson is renderable when it has at least one block with actual content. */
function isReady(doc: LessonDoc | null): boolean {
  return !!doc && doc.blocks.length > 0 && doc.blocks.some(hasRealContent);
}

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
    if (isReady(doc)) return readyResponse(doc!);

    // A placeholder that's still being generated (no blocks yet).
    if (doc && doc.genStatus === "generating" && doc.blocks.length === 0) {
      return json({ status: "generating" });
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
    if (isReady(doc)) return readyResponse(doc!);
    return json({ status: "generating" });
  },
);
