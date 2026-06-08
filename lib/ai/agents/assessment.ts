/**
 * questionGenAgent — produces one diagnostic question at a target difficulty
 * band, probing a sub-skill not yet tested. MCQ preferred (crisp grading);
 * short-answer allowed when an MCQ would be contrived.
 */
import { Agent } from "@openai/agents";
import { modelName } from "@/lib/ai/provider";
import { runAgentStructured } from "@/lib/ai/runAgent";
import { questionSchema, type QuestionOutput } from "@/lib/ai/schemas";

const questionGenAgent = new Agent({
  name: "Assessment Question Generator",
  model: modelName(),
  instructions: `You write a SINGLE diagnostic question to assess a learner's level in a
domain, at a specified difficulty band.

Rules:
- Probe one specific sub-skill ("topic"). Avoid topics already tested.
- Prefer "mcq": provide 3-5 "choices" and a "correctKey" equal to the
  zero-based index of the correct choice as a string (e.g. "2"). Exactly one
  choice is correct.
- Use "short" only when a multiple-choice question would be contrived. For
  "short", include a concise "rubric" describing what a correct answer must
  contain. Do not include choices/correctKey.
- Calibrate difficulty to the requested band precisely.

Respond with ONLY a JSON object of this shape:
{
  "topic": string,
  "type": "mcq" | "short",
  "prompt": string,
  "choices": string[],        // mcq only
  "correctKey": string,       // mcq only, e.g. "0"
  "rubric": string            // short only
}`,
});

export interface QuestionGenInput {
  domain: string;
  refinedTopic: string;
  targetLevel: string;
  avoidTopics: string[];
}

export function runQuestionGenAgent(
  input: QuestionGenInput,
): Promise<QuestionOutput> {
  const avoid =
    input.avoidTopics.length > 0 ? input.avoidTopics.join(", ") : "(none yet)";
  const prompt = `Domain: ${input.domain}
Learning goal: ${input.refinedTopic}
Target difficulty band: ${input.targetLevel}
Topics already tested (avoid these): ${avoid}

Write one diagnostic question and return the JSON object.`;
  return runAgentStructured<QuestionOutput>(
    questionGenAgent,
    prompt,
    questionSchema,
  );
}
