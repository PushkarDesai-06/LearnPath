/**
 * Turns the curriculumAgent's authored structure into a persisted CurriculumDoc:
 * assigns ids/order, maps prerequisite titles -> module ids, and seeds each
 * lesson's mastery from the assessment so already-known material is pre-mastered
 * (the skip-mastered rule).
 */
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import type { CurriculumOutput } from "@/lib/ai/schemas";
import {
  MASTERED_THRESHOLD,
} from "@/lib/domain/mastery";
import {
  DIFFICULTY_LEVELS,
  type AssessmentResult,
  type CurriculumDoc,
  type CurriculumLesson,
  type CurriculumModule,
  type DifficultyLevel,
} from "@/lib/db/models";

function coerceLevel(value: string): DifficultyLevel {
  const v = value.toLowerCase().trim();
  return (DIFFICULTY_LEVELS as string[]).includes(v)
    ? (v as DifficultyLevel)
    : "beginner";
}

/** Seed mastery for a lesson as the mean of its topics' assessed scores. */
function seedMastery(topics: string[], result: AssessmentResult): number {
  const scores = topics
    .map(
      (t) =>
        result.perTopicMastery.find(
          (m) => m.topic.toLowerCase() === t.toLowerCase(),
        )?.score,
    )
    .filter((s): s is number => typeof s === "number");
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function buildCurriculumDoc(params: {
  userId: ObjectId;
  assessmentId: ObjectId;
  domain: string;
  result: AssessmentResult;
  output: CurriculumOutput;
}): CurriculumDoc {
  const { userId, assessmentId, domain, result, output } = params;
  const now = new Date();

  // First pass: assign ids and remember titles -> id for prerequisite mapping.
  const titleToId = new Map<string, string>();
  const withIds = output.modules.map((m, mi) => {
    const id = randomUUID();
    titleToId.set(m.title.toLowerCase().trim(), id);
    return { id, mi, source: m };
  });

  const modules: CurriculumModule[] = withIds.map(({ id, mi, source }) => {
    const lessons: CurriculumLesson[] = source.lessons.map((l, li) => {
      const masteryScore = seedMastery(l.topics, result);
      const mastered = masteryScore >= MASTERED_THRESHOLD;
      return {
        id: randomUUID(),
        title: l.title,
        objectives: l.objectives,
        order: li,
        estMinutes: Math.max(1, Math.round(l.estMinutes || 10)),
        difficultyLevel: coerceLevel(l.difficultyLevel),
        topics: l.topics,
        contentGenerated: false,
        status: mastered ? "mastered" : "available",
        masteryScore,
      };
    });

    const prerequisites = source.prerequisites
      .map((t) => titleToId.get(t.toLowerCase().trim()))
      .filter((x): x is string => typeof x === "string");

    return {
      id,
      title: source.title,
      summary: source.summary,
      order: mi,
      prerequisites,
      status: "available",
      lessons,
    };
  });

  return {
    _id: new ObjectId(),
    userId,
    assessmentId,
    domain,
    title: output.title,
    modules,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}
