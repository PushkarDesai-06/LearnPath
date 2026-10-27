/**
 * The assessment-derived learner profile both generation workers send to their
 * agents: overall level plus strengths, gaps and mastery on the lesson's topics.
 */
import { assessmentsCollection } from "@/lib/db/collections";
import type { CurriculumDoc, CurriculumLesson, TopicMastery } from "@/lib/db/models";

export interface LearnerContext {
  learnerLevel: string;
  strengths?: string[];
  gaps?: string[];
  topicMastery: TopicMastery[];
}

/** Assessment mastery entries for this lesson's topics (case-insensitive). */
export function topicMasteryFor(
  topics: string[],
  mastery: TopicMastery[] | undefined,
): TopicMastery[] {
  const wanted = new Set(topics.map((t) => t.toLowerCase()));
  return (mastery ?? []).filter((m) => wanted.has(m.topic.toLowerCase()));
}

export async function loadLearnerContext(
  curriculum: CurriculumDoc,
  lesson: CurriculumLesson,
): Promise<LearnerContext> {
  const assessments = await assessmentsCollection();
  const assessment = await assessments
    .findOne({ _id: curriculum.assessmentId })
    .lean();
  const result = assessment?.result;
  return {
    learnerLevel: result?.estimatedLevel ?? lesson.difficultyLevel,
    strengths: result?.strengths,
    gaps: result?.gaps,
    topicMastery: topicMasteryFor(lesson.topics, result?.perTopicMastery),
  };
}
