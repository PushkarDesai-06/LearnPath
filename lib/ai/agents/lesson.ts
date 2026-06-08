/**
 * lessonAgent — authors a single lesson's content as a sequence of blocks:
 * explanation, a concrete example, an analogy, code where relevant, and at
 * least two embedded practice questions with explanations.
 */
import { Agent } from "@openai/agents";
import { modelName } from "@/lib/ai/provider";
import { runAgentStructured } from "@/lib/ai/runAgent";
import {
  lessonContentSchema,
  type LessonContentOutput,
} from "@/lib/ai/schemas";

const lessonAgent = new Agent({
  name: "Lesson Author",
  model: modelName(),
  instructions: `You write one interactive lesson as an ordered list of "blocks".

Block kinds and their fields:
- "text": { "markdown": string } — explanation prose (may use markdown).
- "example": { "markdown": string } — a concrete worked example.
- "analogy": { "markdown": string } — an intuitive analogy.
- "code": { "language": string, "code": string, "caption"?: string } — a code
  sample (only when relevant to the subject).
- "practice": { "prompt": string, "type": "mcq"|"short",
    "choices"?: string[], "correctKey"?: string (mcq, zero-based index as
    string), "rubric"?: string (short), "explanation": string } — an embedded
  practice question with a worked explanation.

Requirements:
- Open with a "text" block; include at least one "example" and one "analogy".
- Include at least TWO "practice" blocks, spread through the lesson.
- Calibrate depth to the learner's level.
- Keep each block focused; 6-12 blocks total is typical.

Respond with ONLY a JSON object: { "blocks": [ ... ] }`,
});

export interface LessonGenInput {
  lessonTitle: string;
  objectives: string[];
  topics: string[];
  difficultyLevel: string;
  learnerLevel: string;
}

export function runLessonAgent(
  input: LessonGenInput,
): Promise<LessonContentOutput> {
  const prompt = `Lesson title: ${input.lessonTitle}
Objectives: ${input.objectives.join("; ")}
Topics covered: ${input.topics.join(", ")}
Lesson difficulty: ${input.difficultyLevel}
Learner's overall level: ${input.learnerLevel}

Write the lesson and return the JSON object.`;
  return runAgentStructured<LessonContentOutput>(
    lessonAgent,
    prompt,
    lessonContentSchema,
  );
}
