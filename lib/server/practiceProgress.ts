import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { progressEventsCollection } from "@/lib/db/collections";
import { lessonStatusFor, updateMastery } from "@/lib/domain/mastery";
import { requireLessonAccess } from "@/lib/server/lessonAccess";
import { mutateCurriculum } from "@/lib/server/curriculumMutation";

/** Stable event identity makes retrying a partially saved request safe. */
export function progressEventId(...parts: string[]): ObjectId {
  return new ObjectId(createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24));
}

export async function recordPractice(params: {
  userId: ObjectId;
  curriculumId: ObjectId;
  lessonId: string;
  questionId: string;
  correct: boolean;
  outcome: number;
  countsTowardMastery: boolean;
}) {
  const { userId, curriculumId, lessonId, questionId } = params;
  const result = await mutateCurriculum(userId, curriculumId, (doc) => {
    const lesson = requireLessonAccess(doc, lessonId);
    let receipt = lesson.practiceAttempts?.find((a) => a.questionId === questionId);
    const counted = params.countsTowardMastery && !receipt;
    if (counted) {
      lesson.masteryScore = updateMastery(lesson.masteryScore, params.outcome);
      lesson.status = lessonStatusFor(lesson.masteryScore, true);
      receipt = { questionId, correct: params.correct, score: lesson.masteryScore, at: new Date() };
      lesson.practiceAttempts = [...(lesson.practiceAttempts ?? []), receipt];
    }
    return {
      changed: counted,
      value: { counted, masteryScore: lesson.masteryScore, status: lesson.status, receipt, topics: lesson.topics },
    };
  });

  // A retry also repairs an event write that failed after mastery was saved.
  if (result.receipt) {
    const events = await progressEventsCollection();
    const base = { userId, curriculumId, lessonRef: lessonId, topics: result.topics, at: result.receipt.at };
    const identity = [userId.toHexString(), curriculumId.toHexString(), lessonId, questionId];
    await events.updateOne(
      { _id: progressEventId(...identity, "practice_answered") },
      { $setOnInsert: { ...base, type: "practice_answered", correct: result.receipt.correct, score: result.receipt.score } },
      { upsert: true },
    );
    if (lessonStatusFor(result.receipt.score, true) === "needs_review") {
      await events.updateOne(
        { _id: progressEventId(...identity, "review_triggered") },
        { $setOnInsert: { ...base, type: "review_triggered" } },
        { upsert: true },
      );
    }
  }
  return { counted: result.counted, masteryScore: result.masteryScore, status: result.status };
}
