/**
 * Learner model: mastery scoring (EWMA) and the status transitions that follow
 * from a score. Pure functions over numbers/statuses — no I/O.
 */
import type { CurriculumLesson, LessonStatus } from "@/lib/db/models";

export const MASTERY_ALPHA = 0.5; // weight of the newest observation
export const MASTERED_THRESHOLD = 0.8;
export const REVIEW_THRESHOLD = 0.4;

/**
 * Exponentially-weighted moving average update.
 * outcome is in [0,1] (1 = fully correct; grader confidence for short answers).
 */
export function updateMastery(prev: number, outcome: number): number {
  const clamped = Math.max(0, Math.min(1, outcome));
  return MASTERY_ALPHA * clamped + (1 - MASTERY_ALPHA) * prev;
}

/**
 * Status for a lesson after an interaction, given its (updated) mastery score.
 * `completed` marks that the learner has worked through the lesson at least once.
 */
export function lessonStatusFor(
  score: number,
  completed: boolean,
): LessonStatus {
  if (score >= MASTERED_THRESHOLD) return "mastered";
  if (completed && score < REVIEW_THRESHOLD) return "needs_review";
  return "in_progress";
}

/** A lesson counts as "done" for module-completion if mastered. */
export function isLessonDone(lesson: CurriculumLesson): boolean {
  return lesson.status === "mastered";
}

// Module status / accessibility gating lives in `domain/adapt.ts`
// (`gateModuleStatuses`) — it needs the whole ordered module list, not a single
// module, to apply the sliding access window.
