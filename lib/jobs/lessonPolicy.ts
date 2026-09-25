import type { LessonDoc } from "@/lib/db/models";

export const MAX_LESSON_ATTEMPTS = 3;

export function lessonRetryState(doc: LessonDoc, now = Date.now()) {
  const attempts = doc.generationAttempts ?? 1;
  const retryAt = doc.failedAt
    ? doc.failedAt.getTime() + 10_000 * 2 ** Math.max(0, attempts - 1)
    : now;
  return {
    canRetry: attempts < MAX_LESSON_ATTEMPTS,
    retryAfterMs: Math.max(0, retryAt - now),
  };
}
