/**
 * curriculumAgent — generates a prerequisite-ordered learning path from the
 * assessment diagnosis. The route assigns ids/order/status and seeds mastery;
 * this agent only authors the structure and content outline.
 */
import { Agent } from "@openai/agents";
import { modelName } from "@/lib/ai/provider";
import { runAgentStructured } from "@/lib/ai/runAgent";
import { curriculumSchema, type CurriculumOutput } from "@/lib/ai/schemas";
import type { AssessmentResult } from "@/lib/db/models";

const curriculumAgent = new Agent({
  name: "Curriculum Architect",
  model: modelName(),
  instructions: `You design a personalized, prerequisite-ordered learning path for a
single learner, given their assessed level and per-topic strengths/gaps.

Principles:
- Sequence modules so each builds on earlier ones; list prerequisite module
  TITLES in "prerequisites" (exact titles you used; empty array for first
  modules). Do not create cycles.
- Condense or skip topics the learner already shows strength in; expand topics
  that are gaps into more, smaller lessons.
- Start near (slightly below) the learner's estimated level and progress upward.
- Each lesson has clear "objectives", a realistic "estMinutes", a
  "difficultyLevel" (novice|beginner|intermediate|advanced|expert), and the
  "topics" it covers (reuse the assessment topic names where relevant so
  mastery can be tracked).
- Aim for 3-6 modules, each with 2-5 lessons.

Respond with ONLY a JSON object:
{
  "title": string,
  "modules": [
    {
      "title": string,
      "summary": string,
      "prerequisites": string[],
      "lessons": [
        { "title": string, "objectives": string[], "estMinutes": number,
          "difficultyLevel": string, "topics": string[] }
      ]
    }
  ]
}`,
});

export interface CurriculumGenInput {
  domain: string;
  refinedTopic: string;
  result: AssessmentResult;
}

export function runCurriculumAgent(
  input: CurriculumGenInput,
): Promise<CurriculumOutput> {
  const { result } = input;
  const mastery = result.perTopicMastery
    .map((t) => `${t.topic}: ${(t.score * 100).toFixed(0)}%`)
    .join(", ");
  const prompt = `Domain: ${input.domain}
Learning goal: ${input.refinedTopic}
Estimated level: ${result.estimatedLevel}
Strengths: ${result.strengths.join(", ") || "(none identified)"}
Gaps: ${result.gaps.join(", ") || "(none identified)"}
Per-topic mastery: ${mastery || "(none)"}

Design the learning path and return the JSON object.`;
  return runAgentStructured<CurriculumOutput>(
    curriculumAgent,
    prompt,
    curriculumSchema,
  );
}
