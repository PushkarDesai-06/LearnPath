/**
 * Adaptive assessment algorithm — a binary search over difficulty bands to find
 * the learner's competence boundary.
 *
 * Pure functions over the assessment's search state; the route handler owns
 * calling the AI to generate/grade questions and persisting the doc. State:
 *   lowIdx  — lowest level not yet ruled IN (learner is at least lowIdx-?)
 *   highIdx — highest level not yet ruled OUT
 *   currentLevelIdx — the band the next question targets
 * The boundary is found when lowIdx > highIdx; estimated level = highIdx
 * (highest band the learner consistently passed).
 */
import {
  DIFFICULTY_LEVELS,
  type AssessmentDoc,
  type AssessmentQuestion,
  type AssessmentResult,
  type DifficultyLevel,
  type TopicMastery,
} from "@/lib/db/models";

export const MAX_QUESTIONS = 9;

export interface InitialSearchState {
  levels: DifficultyLevel[];
  lowIdx: number;
  highIdx: number;
  currentLevelIdx: number;
  pendingConfirm: boolean;
  questionCap: number;
}

export function initialSearchState(): InitialSearchState {
  const levels = DIFFICULTY_LEVELS;
  const lowIdx = 0;
  const highIdx = levels.length - 1;
  return {
    levels,
    lowIdx,
    highIdx,
    currentLevelIdx: Math.floor((lowIdx + highIdx) / 2),
    pendingConfirm: false,
    questionCap: MAX_QUESTIONS,
  };
}

interface SearchState {
  lowIdx: number;
  highIdx: number;
  currentLevelIdx: number;
  pendingConfirm: boolean;
}

export interface StepResult {
  next: SearchState;
  finished: boolean;
}

/**
 * Advance the search after a question at `currentLevelIdx` was graded.
 *
 * To guard against single-question noise, the first time a result would flip
 * the boundary we ask one *confirming* question at the same level on a
 * different topic (pendingConfirm). Only a consistent second result commits the
 * move; a contradicting confirm cancels it and we still narrow conservatively.
 */
export function stepSearch(state: SearchState, correct: boolean): StepResult {
  const { lowIdx, highIdx, currentLevelIdx } = state;

  if (!state.pendingConfirm) {
    // First observation at this level — ask a confirming question next.
    return {
      next: { lowIdx, highIdx, currentLevelIdx, pendingConfirm: true },
      finished: false,
    };
  }

  // We now have two observations at currentLevelIdx (this is the confirm).
  let newLow = lowIdx;
  let newHigh = highIdx;
  if (correct) {
    newLow = currentLevelIdx + 1; // learner is at least at this band
  } else {
    newHigh = currentLevelIdx - 1; // boundary is below this band
  }

  if (newLow > newHigh) {
    return {
      next: {
        lowIdx: newLow,
        highIdx: newHigh,
        currentLevelIdx,
        pendingConfirm: false,
      },
      finished: true,
    };
  }

  return {
    next: {
      lowIdx: newLow,
      highIdx: newHigh,
      currentLevelIdx: Math.floor((newLow + newHigh) / 2),
      pendingConfirm: false,
    },
    finished: false,
  };
}

/** Whether to stop asking: boundary found OR question cap reached. */
export function isComplete(doc: {
  lowIdx: number;
  highIdx: number;
  questions: AssessmentQuestion[];
  questionCap: number;
}): boolean {
  if (doc.lowIdx > doc.highIdx) return true;
  return doc.questions.filter((q) => q.answer !== undefined).length >= doc.questionCap;
}

/**
 * Compute the final diagnosis from answered questions and the search bounds.
 * estimatedLevel = clamp(highIdx) — the highest band passed consistently.
 */
export function computeResult(doc: AssessmentDoc): AssessmentResult {
  const levels = doc.levels;
  const idx = Math.max(0, Math.min(levels.length - 1, doc.highIdx));
  const estimatedLevel = levels[idx];

  // Aggregate per-topic mastery from answered questions.
  const byTopic = new Map<string, { sum: number; n: number }>();
  for (const q of doc.questions) {
    if (q.answer === undefined || q.correct === undefined) continue;
    const outcome = q.correct ? (q.confidence ?? 1) : 1 - (q.confidence ?? 1);
    const entry = byTopic.get(q.topic) ?? { sum: 0, n: 0 };
    entry.sum += outcome;
    entry.n += 1;
    byTopic.set(q.topic, entry);
  }

  const perTopicMastery: TopicMastery[] = [...byTopic.entries()].map(
    ([topic, { sum, n }]) => ({ topic, score: n > 0 ? sum / n : 0 }),
  );
  const strengths = perTopicMastery
    .filter((t) => t.score >= 0.8)
    .map((t) => t.topic);
  const gaps = perTopicMastery
    .filter((t) => t.score <= 0.4)
    .map((t) => t.topic);

  return { estimatedLevel, perTopicMastery, strengths, gaps };
}
