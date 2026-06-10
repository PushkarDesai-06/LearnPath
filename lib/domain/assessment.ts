/**
 * Batch quiz scoring + level estimation (pure functions).
 *
 * The assessment is a quiz of MCQs spread across difficulty bands, graded all at
 * once. We estimate the learner's level from the highest *contiguously passed*
 * band, and only recommend a second quiz when results look noisy (a harder band
 * passed while an easier one failed — i.e. likely guessing).
 */
import {
  DIFFICULTY_LEVELS,
  type AssessmentDoc,
  type AssessmentQuestion,
  type AssessmentResult,
  type DifficultyLevel,
  type TopicMastery,
} from "@/lib/db/models";

const PASS_THRESHOLD = 0.5;

/** Round-1 quiz shape: levelIdx for each question (8 questions across bands). */
export const ROUND1_LEVELS = [0, 0, 1, 1, 2, 2, 3, 4];

export const MAX_ROUNDS = 2;

export function levelName(idx: number): DifficultyLevel {
  const i = Math.max(0, Math.min(DIFFICULTY_LEVELS.length - 1, idx));
  return DIFFICULTY_LEVELS[i];
}

export function levelIndex(name: string): number {
  const i = DIFFICULTY_LEVELS.indexOf(name.toLowerCase() as DifficultyLevel);
  return i === -1 ? 1 : i;
}

function answered(questions: AssessmentQuestion[]): AssessmentQuestion[] {
  return questions.filter((q) => q.answer !== undefined && q.correct !== undefined);
}

/** Accuracy per difficulty band, only for bands that actually have questions. */
function bandAccuracy(
  questions: AssessmentQuestion[],
): { band: number; acc: number; n: number }[] {
  const out: { band: number; acc: number; n: number }[] = [];
  for (let b = 0; b < DIFFICULTY_LEVELS.length; b++) {
    const qs = answered(questions).filter((q) => q.levelIdx === b);
    if (qs.length === 0) continue;
    const correct = qs.filter((q) => q.correct).length;
    out.push({ band: b, acc: correct / qs.length, n: qs.length });
  }
  return out;
}

/** Highest contiguously-passed band (the competence boundary). */
export function estimateLevelIdx(questions: AssessmentQuestion[]): number {
  let est = 0;
  for (const { band, acc } of bandAccuracy(questions)) {
    if (acc >= PASS_THRESHOLD) est = band;
    else break;
  }
  return est;
}

/**
 * Recommend another round only when band results are NON-MONOTONIC: the learner
 * passed a harder band but failed an easier one (looks like guessing/noise).
 */
export function recommendAnotherRound(questions: AssessmentQuestion[]): boolean {
  const bands = bandAccuracy(questions);
  for (let i = 0; i < bands.length; i++) {
    for (let j = i + 1; j < bands.length; j++) {
      if (bands[i].acc < PASS_THRESHOLD && bands[j].acc >= PASS_THRESHOLD) {
        return true; // a lower band failed while a higher band passed
      }
    }
  }
  return false;
}

/** Difficulty bands for a focused round-2 quiz near the estimated boundary. */
export function round2Levels(estIdx: number): number[] {
  const lo = Math.max(0, estIdx - 1);
  const hi = Math.min(DIFFICULTY_LEVELS.length - 1, estIdx + 1);
  return [lo, estIdx, estIdx, hi];
}

export function computeResult(doc: AssessmentDoc): AssessmentResult {
  const qs = answered(doc.questions);
  const correct = qs.filter((q) => q.correct).length;
  const score = qs.length > 0 ? correct / qs.length : 0;
  const estimatedLevel = levelName(estimateLevelIdx(doc.questions));

  const byTopic = new Map<string, { sum: number; n: number }>();
  for (const q of qs) {
    const entry = byTopic.get(q.topic) ?? { sum: 0, n: 0 };
    entry.sum += q.correct ? 1 : 0;
    entry.n += 1;
    byTopic.set(q.topic, entry);
  }
  const perTopicMastery: TopicMastery[] = [...byTopic.entries()].map(
    ([topic, { sum, n }]) => ({ topic, score: n > 0 ? sum / n : 0 }),
  );
  const strengths = perTopicMastery.filter((t) => t.score >= 0.8).map((t) => t.topic);
  const gaps = perTopicMastery.filter((t) => t.score <= 0.4).map((t) => t.topic);

  return { estimatedLevel, score, perTopicMastery, strengths, gaps };
}
