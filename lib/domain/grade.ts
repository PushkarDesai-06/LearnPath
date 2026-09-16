/**
 * Pure grading helpers. Shared by the assessment + lesson-practice routes AND by
 * the lesson page in the browser, which grades MCQs locally for instant feedback
 * (see `publicLessonBlock`). Both sides must agree, so there is exactly one copy.
 */

/** MCQ correctness: accept either the choice index (as string) or choice text. */
export function gradeMcq(
  answer: string,
  correctKey: string | undefined,
  choices: string[] | undefined,
): boolean {
  if (correctKey === undefined) return false;
  const a = answer.trim();
  if (a === correctKey.trim()) return true;
  if (choices) {
    const idx = Number(correctKey);
    if (!Number.isNaN(idx) && choices[idx]?.trim() === a) return true;
  }
  return false;
}

/** Map a grade to an EWMA outcome in [0,1]. */
export function outcomeFromGrade(correct: boolean, confidence: number): number {
  return correct ? confidence : 1 - confidence;
}
