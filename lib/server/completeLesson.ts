import type { ObjectId } from "mongodb";
import { progressEventsCollection } from "@/lib/db/collections";
import { adaptCurriculum } from "@/lib/domain/adapt";
import { lessonStatusFor, updateMastery } from "@/lib/domain/mastery";
import { requireLessonAccess } from "@/lib/server/lessonAccess";
import { mutateCurriculum } from "@/lib/server/curriculumMutation";
import { progressEventId } from "@/lib/server/practiceProgress";

export async function completeLesson(params: {
  userId: ObjectId;
  curriculumId: ObjectId;
  lessonRef: string;
  timeSpentMs?: number;
}) {
  const { userId, curriculumId, lessonRef, timeSpentMs } = params;
  const events = await progressEventsCollection();
  // Compatibility with attempts made before per-question receipts were stored.
  const legacyPractice = await events.exists({ userId, curriculumId, lessonRef, type: "practice_answered" });
  const result = await mutateCurriculum(userId, curriculumId, (doc) => {
    const lesson = requireLessonAccess(doc, lessonRef);
    const firstCompletion = !lesson.completion;
    if (firstCompletion) {
      if (!legacyPractice && !lesson.practiceAttempts?.length) {
        lesson.masteryScore = updateMastery(lesson.masteryScore, 0.7);
      }
      lesson.completion = { at: new Date(), timeSpentMs };
      lesson.status = lessonStatusFor(lesson.masteryScore, true);
    }
    const adapted = adaptCurriculum(doc);
    doc.modules = adapted.modules;
    if (adapted.changed) doc.version += 1;
    return {
      changed: firstCompletion || adapted.changed,
      value: { status: lesson.status, masteryScore: lesson.masteryScore,
        reordered: adapted.changed, version: doc.version, topics: lesson.topics,
        completion: lesson.completion! },
    };
  });

  const identity = [userId.toHexString(), curriculumId.toHexString(), lessonRef];
  const base = { userId, curriculumId, lessonRef, topics: result.topics };
  await events.updateOne(
    { _id: progressEventId(...identity, "lesson_completed") },
    { $setOnInsert: { ...base, type: "lesson_completed", ...result.completion } },
    { upsert: true },
  );
  if (result.reordered) {
    await events.updateOne(
      { _id: progressEventId(...identity, "curriculum_reordered", String(result.version)) },
      { $setOnInsert: { ...base, type: "curriculum_reordered", at: new Date() } },
      { upsert: true },
    );
  }
  return { lessonRef, status: result.status, masteryScore: Number(result.masteryScore.toFixed(3)),
    reordered: result.reordered, version: result.version };
}
