/**
 * Server-side helpers for the batch quiz: generating a round of questions, the
 * learner-safe (answer-stripped) question shape, and the post-submit review
 * shape (which DOES reveal the correct answer).
 */
import { randomUUID } from "node:crypto";
import { runQuizGenAgent } from "@/lib/ai/agents/assessment";
import { levelIndex, levelName } from "@/lib/domain/assessment";
import type { AssessmentQuestion } from "@/lib/db/models";

/** Generate one quiz round at the given difficulty bands. */
export async function generateQuizRound(params: {
  domain: string;
  refinedTopic: string;
  round: number;
  levels: number[];
  avoidTopics?: string[];
}): Promise<AssessmentQuestion[]> {
  const quiz = await runQuizGenAgent({
    domain: params.domain,
    refinedTopic: params.refinedTopic,
    targetLevels: params.levels.map(levelName),
    avoidTopics: params.avoidTopics,
  });
  const now = new Date();
  return quiz.questions.map((q) => ({
    id: randomUUID(),
    round: params.round,
    levelIdx: levelIndex(q.level),
    topic: q.topic,
    prompt: q.prompt,
    type: "mcq" as const,
    choices: q.choices,
    correctKey: q.correctKey,
    askedAt: now,
  }));
}

/** Learner-safe question — NO correctKey (the answer key must stay server-side). */
export function publicQuestion(q: AssessmentQuestion) {
  return {
    id: q.id,
    round: q.round,
    prompt: q.prompt,
    type: q.type,
    choices: q.choices ?? null,
    topic: q.topic,
    level: q.levelIdx,
  };
}

/** Post-submit review item — reveals the correct answer (assessment is graded). */
export function reviewItem(q: AssessmentQuestion) {
  return {
    id: q.id,
    prompt: q.prompt,
    choices: q.choices ?? null,
    topic: q.topic,
    level: q.levelIdx,
    yourAnswer: q.answer ?? null,
    correctKey: q.correctKey ?? null,
    correct: q.correct ?? null,
  };
}
