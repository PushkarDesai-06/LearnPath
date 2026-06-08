/**
 * Shared server-side helpers for the adaptive assessment flow (used by both the
 * start and answer routes): generating + appending a question, and projecting a
 * question to its learner-safe public shape.
 */
import { randomUUID } from "node:crypto";
import { runQuestionGenAgent } from "@/lib/ai/agents/assessment";
import type { AssessmentDoc, AssessmentQuestion } from "@/lib/db/models";

/** The learner-safe view of a question (no correctKey/rubric). */
export function publicQuestion(q: AssessmentQuestion) {
  return {
    id: q.id,
    prompt: q.prompt,
    type: q.type,
    choices: q.choices ?? null,
    topic: q.topic,
    level: q.levelIdx,
  };
}

/**
 * Generate one question at the doc's current target level on an untested topic,
 * returning the new AssessmentQuestion (not yet persisted).
 */
export async function generateNextQuestion(
  doc: Pick<
    AssessmentDoc,
    "domain" | "refinedTopic" | "levels" | "currentLevelIdx" | "askedTopics"
  >,
): Promise<AssessmentQuestion> {
  const targetLevel = doc.levels[doc.currentLevelIdx];
  const generated = await runQuestionGenAgent({
    domain: doc.domain,
    refinedTopic: doc.refinedTopic,
    targetLevel,
    avoidTopics: doc.askedTopics,
  });

  return {
    id: randomUUID(),
    levelIdx: doc.currentLevelIdx,
    topic: generated.topic,
    prompt: generated.prompt,
    type: generated.type,
    choices: generated.choices,
    correctKey: generated.correctKey,
    rubric: generated.rubric,
    askedAt: new Date(),
  };
}
