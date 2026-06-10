/**
 * quizGenAgent — generates a whole diagnostic quiz in ONE call.
 *
 * Generating the full set together (rather than one question per call) is faster
 * and lets the model deliberately spread topics and difficulty across the quiz,
 * instead of each independent call risking repeats.
 */
import { Agent } from "@openai/agents";
import { modelName } from "@/lib/ai/provider";
import { runAgentStructured } from "@/lib/ai/runAgent";
import { quizSchema, type QuizOutput } from "@/lib/ai/schemas";

const quizGenAgent = new Agent({
  name: "Quiz Generator",
  model: modelName(),
  instructions: `You write a diagnostic multiple-choice quiz to assess a learner's level
in a domain.

Rules:
- Every question is multiple-choice: 3-5 "choices" with exactly one correct, and
  "correctKey" = the zero-based index of the correct choice as a string (e.g. "2").
- Each question has a "level" from: novice, beginner, intermediate, advanced, expert.
- Spread the questions across the requested difficulty levels (roughly the given
  counts), and across DIFFERENT sub-skills ("topic") — do not repeat a topic.
- Keep prompts self-contained and unambiguous; calibrate difficulty to each level.

Respond with ONLY a JSON object of this shape:
{
  "questions": [
    { "topic": string, "level": "novice"|"beginner"|"intermediate"|"advanced"|"expert",
      "prompt": string, "choices": string[], "correctKey": string }
  ]
}`,
});

export interface QuizGenInput {
  domain: string;
  refinedTopic: string;
  /** difficulty bands to cover, repeated to express how many of each, e.g. ["novice","novice","beginner",...] */
  targetLevels: string[];
  avoidTopics?: string[];
}

export function runQuizGenAgent(input: QuizGenInput): Promise<QuizOutput> {
  const counts: Record<string, number> = {};
  for (const l of input.targetLevels) counts[l] = (counts[l] ?? 0) + 1;
  const distribution = Object.entries(counts)
    .map(([lvl, n]) => `${n} ${lvl}`)
    .join(", ");
  const avoid =
    input.avoidTopics && input.avoidTopics.length > 0
      ? `\nAvoid these already-tested topics: ${input.avoidTopics.join(", ")}.`
      : "";

  const prompt = `Domain: ${input.domain}
Learning goal: ${input.refinedTopic}
Generate ${input.targetLevels.length} questions with this difficulty distribution: ${distribution}.${avoid}

Return the JSON object.`;
  return runAgentStructured<QuizOutput>(quizGenAgent, prompt, quizSchema);
}
