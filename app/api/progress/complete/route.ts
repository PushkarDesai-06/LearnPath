/**
 * Mark a lesson complete: finalize its mastery, run the deterministic adaptation
 * pass (reorder / revisit / module-status), and log progress events.
 */
import { z } from "zod";
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth/guards";
import {
  curriculaCollection,
  progressEventsCollection,
} from "@/lib/db/collections";
import { adaptCurriculum } from "@/lib/domain/adapt";
import { lessonStatusFor, updateMastery } from "@/lib/domain/mastery";
import { badRequest, handler, json, notFound, readJson } from "@/lib/http";

const COMPLETION_OUTCOME = 0.7; // credit for working through a lesson with no graded practice

const Body = z.object({
  curriculumId: z.string(),
  lessonRef: z.string(),
  timeSpentMs: z.number().int().nonnegative().optional(),
});

export const POST = handler(async (request) => {
  const user = await requireUser();
  const { curriculumId, lessonRef, timeSpentMs } = await readJson(request, Body);
  if (!ObjectId.isValid(curriculumId)) throw badRequest("Invalid curriculumId");

  const curricula = await curriculaCollection();
  const curriculum = await curricula
    .findOne({ _id: new ObjectId(curriculumId), userId: user._id })
    .lean();
  if (!curriculum) throw notFound("Curriculum not found");

  // Find the lesson.
  let found = false;
  let topics: string[] = [];
  const events = await progressEventsCollection();

  // Was the lesson practiced? If not, completion gives a modest mastery credit.
  const practiceCount = await events.countDocuments({
    userId: user._id,
    curriculumId: curriculum._id,
    lessonRef,
    type: "practice_answered",
  });

  for (const mod of curriculum.modules) {
    const lesson = mod.lessons.find((l) => l.id === lessonRef);
    if (!lesson) continue;
    found = true;
    topics = lesson.topics;
    if (practiceCount === 0) {
      lesson.masteryScore = updateMastery(lesson.masteryScore, COMPLETION_OUTCOME);
    }
    lesson.status = lessonStatusFor(lesson.masteryScore, true);
    break;
  }
  if (!found) throw notFound("Lesson not found in curriculum");

  // Adaptation pass: reorder + recompute module statuses.
  const { modules, changed } = adaptCurriculum(curriculum);
  curriculum.modules = modules;
  const newVersion = changed ? curriculum.version + 1 : curriculum.version;

  await curricula.updateOne(
    { _id: curriculum._id },
    { $set: { modules, version: newVersion, updatedAt: new Date() } },
  );

  const now = new Date();
  await events.create({
    _id: new ObjectId(),
    userId: user._id,
    curriculumId: curriculum._id,
    lessonRef,
    type: "lesson_completed",
    topics,
    timeSpentMs,
    at: now,
  });
  if (changed) {
    await events.create({
      _id: new ObjectId(),
      userId: user._id,
      curriculumId: curriculum._id,
      lessonRef,
      type: "curriculum_reordered",
      at: now,
    });
  }

  // Report the lesson's resulting status.
  const updatedLesson = modules
    .flatMap((m) => m.lessons)
    .find((l) => l.id === lessonRef);

  return json({
    lessonRef,
    status: updatedLesson?.status ?? null,
    masteryScore: updatedLesson
      ? Number(updatedLesson.masteryScore.toFixed(3))
      : null,
    reordered: changed,
    version: newVersion,
  });
});
