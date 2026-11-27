/**
 * Learner-initiated changes to one lesson's standing: mark it for review, or
 * reset it. Both go through the revision-fenced curriculum mutation and the
 * deterministic adaptation pass, and both honour the module access window, so a
 * locked lesson cannot be touched.
 */
import { ObjectId } from "mongodb";
import { progressEventsCollection } from "@/lib/db/collections";
import type { CurriculumDoc, CurriculumLesson } from "@/lib/db/models";
import { adaptCurriculum } from "@/lib/domain/adapt";
import { MASTERED_THRESHOLD } from "@/lib/domain/mastery";
import { forbidden, notFound } from "@/lib/http";
import { mutateCurriculum } from "@/lib/server/curriculumMutation";
import { locateLesson } from "@/lib/server/curriculumLocate";
import { requireLessonAccess } from "@/lib/server/lessonAccess";

/** Just under mastered, so the "keep mastered lessons mastered" rule lets the review stand. */
const REVIEW_SCORE_CEILING = MASTERED_THRESHOLD - 0.01;

export interface LessonStandingResult {
  lessonRef: string;
  status: CurriculumLesson["status"];
  masteryScore: number;
  reordered: boolean;
  version: number;
}

function requireEditable(doc: CurriculumDoc, lessonRef: string): CurriculumLesson {
  const lesson = requireLessonAccess(doc, lessonRef);
  if (lesson.status === "locked") throw forbidden("This lesson is locked.");
  return lesson;
}

async function changeLesson(
  userId: ObjectId,
  lessonRef: string,
  change: (lesson: CurriculumLesson) => boolean,
): Promise<{ result: LessonStandingResult; curriculumId: ObjectId; topics: string[]; changed: boolean }> {
  const located = await locateLesson(userId, lessonRef);
  if (!located) throw notFound("Lesson not found");
  const curriculumId = located.curriculum._id;

  const outcome = await mutateCurriculum(userId, curriculumId, (doc) => {
    const lesson = requireEditable(doc, lessonRef);
    const lessonChanged = change(lesson);
    const adapted = adaptCurriculum(doc);
    doc.modules = adapted.modules;
    if (adapted.changed) doc.version += 1;
    return {
      changed: lessonChanged || adapted.changed,
      value: {
        changed: lessonChanged,
        topics: lesson.topics,
        result: {
          lessonRef,
          status: lesson.status,
          masteryScore: Number(lesson.masteryScore.toFixed(3)),
          reordered: adapted.changed,
          version: doc.version,
        },
      },
    };
  });
  return { ...outcome, curriculumId };
}

export async function markLessonForReview(userId: ObjectId, lessonRef: string) {
  const { result, curriculumId, topics, changed } = await changeLesson(userId, lessonRef, (lesson) => {
    const score = Math.min(lesson.masteryScore, REVIEW_SCORE_CEILING);
    const differs = lesson.status !== "needs_review" || score !== lesson.masteryScore;
    lesson.masteryScore = score;
    lesson.status = "needs_review";
    return differs;
  });
  if (changed) {
    const events = await progressEventsCollection();
    await events.create({
      _id: new ObjectId(),
      userId,
      curriculumId,
      lessonRef,
      type: "review_triggered",
      topics,
      at: new Date(),
    });
  }
  return result;
}

/** Clears mastery, counted attempts and completion. The written lesson content is untouched. */
export async function resetLessonProgress(userId: ObjectId, lessonRef: string) {
  const { result } = await changeLesson(userId, lessonRef, (lesson) => {
    lesson.masteryScore = 0;
    lesson.status = "available";
    delete lesson.practiceAttempts;
    delete lesson.completion;
    return true;
  });
  return result;
}
