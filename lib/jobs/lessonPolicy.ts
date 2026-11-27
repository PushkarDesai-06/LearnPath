import type { LessonDoc } from "@/lib/db/models";
import { ApiError } from "@/lib/http";

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

/** The lesson or its topic was deleted while a job was running. */
export class LessonGoneError extends Error {}

/** Expected when a topic is deleted mid flight: not worth an error log. */
export function isLessonGone(error: unknown): boolean {
  return error instanceof LessonGoneError || (error instanceof ApiError && error.status === 404);
}
