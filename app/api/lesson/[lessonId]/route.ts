/**
 * GET a lesson's content. Generates and persists it on first access
 * (lazy generation), then returns the learner-safe blocks.
 */
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth/guards";
import {
  assessmentsCollection,
  curriculaCollection,
  lessonsCollection,
  progressEventsCollection,
} from "@/lib/db/collections";
import type { LessonBlock, LessonDoc } from "@/lib/db/models";
import { runLessonAgent } from "@/lib/ai/agents/lesson";
import { modelName } from "@/lib/ai/provider";
import { locateLesson, publicLessonBlock } from "@/lib/server/curriculumLocate";
import { handler, json, notFound } from "@/lib/http";

export const GET = handler(
  async (_request, ctx: { params: Promise<{ lessonId: string }> }) => {
    const { lessonId } = await ctx.params;
    const user = await requireUser();

    const located = await locateLesson(user._id, lessonId);
    if (!located) throw notFound("Lesson not found");
    const { curriculum, lesson } = located;

    const lessons = await lessonsCollection();
    let lessonDoc: LessonDoc | null = await lessons
      .findOne({
        userId: user._id,
        curriculumId: curriculum._id,
        lessonRef: lessonId,
      })
      .lean();

    if (!lessonDoc) {
      // Resolve the learner's overall level for content calibration.
      const assessments = await assessmentsCollection();
      const assessment = await assessments
        .findOne({ _id: curriculum.assessmentId })
        .lean();
      const learnerLevel =
        assessment?.result?.estimatedLevel ?? lesson.difficultyLevel;

      const content = await runLessonAgent({
        lessonTitle: lesson.title,
        objectives: lesson.objectives,
        topics: lesson.topics,
        difficultyLevel: lesson.difficultyLevel,
        learnerLevel,
      });

      // Assign stable ids to practice blocks.
      const blocks: LessonBlock[] = content.blocks.map((b) =>
        b.kind === "practice" ? { ...b, questionId: randomUUID() } : b,
      );

      lessonDoc = {
        _id: new ObjectId(),
        userId: user._id,
        curriculumId: curriculum._id,
        lessonRef: lessonId,
        title: lesson.title,
        blocks,
        generatedAt: new Date(),
        model: modelName(),
      } satisfies LessonDoc;
      await lessons.create(lessonDoc);

      // Mark generated; flip available -> in_progress; log the start event.
      // Doubly-nested positional updates run on the native collection to avoid
      // Mongoose's positional-path casting quirks with `$[].$[l]`.
      const curricula = await curriculaCollection();
      await curricula.collection.updateOne(
        { _id: curriculum._id },
        {
          $set: {
            "modules.$[].lessons.$[l].contentGenerated": true,
            updatedAt: new Date(),
          },
        },
        { arrayFilters: [{ "l.id": lessonId }] },
      );
      await curricula.collection.updateOne(
        { _id: curriculum._id },
        { $set: { "modules.$[].lessons.$[l].status": "in_progress" } },
        { arrayFilters: [{ "l.id": lessonId, "l.status": "available" }] },
      );

      const events = await progressEventsCollection();
      await events.create({
        _id: new ObjectId(),
        userId: user._id,
        curriculumId: curriculum._id,
        lessonRef: lessonId,
        type: "lesson_started",
        topics: lesson.topics,
        at: new Date(),
      });
    }

    return json({
      lesson: {
        id: lessonId,
        curriculumId: curriculum._id.toHexString(),
        title: lessonDoc.title,
        blocks: lessonDoc.blocks.map(publicLessonBlock),
      },
    });
  },
);
