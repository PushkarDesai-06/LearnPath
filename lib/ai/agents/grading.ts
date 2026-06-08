/**
 * answerGradeAgent — grades a free-text (short) answer against a rubric.
 * MCQ answers are graded by key comparison in the route (no LLM call).
 */
import { Agent } from "@openai/agents";
import { modelName } from "@/lib/ai/provider";
import { runAgentStructured } from "@/lib/ai/runAgent";
import { gradeSchema, type GradeOutput } from "@/lib/ai/schemas";

const answerGradeAgent = new Agent({
  name: "Answer Grader",
  model: modelName(),
  instructions: `You grade a learner's short free-text answer against a rubric.

Judge correctness on substance, not wording. Be fair to partially-correct
answers: set "confidence" to reflect how fully the answer satisfies the rubric
(1 = fully correct, 0.5 = partially, 0 = incorrect), and set "correct" true when
confidence >= 0.6. Give one or two sentences of constructive "feedback".

Respond with ONLY a JSON object:
{ "correct": boolean, "confidence": number, "feedback": string }`,
});

export interface GradeInput {
  prompt: string;
  rubric: string;
  learnerAnswer: string;
}

export function runAnswerGradeAgent(input: GradeInput): Promise<GradeOutput> {
  const prompt = `Question:\n${input.prompt}\n\nRubric for a correct answer:\n${input.rubric}\n\nLearner's answer:\n"""\n${input.learnerAnswer}\n"""\n\nGrade it and return the JSON object.`;
  return runAgentStructured<GradeOutput>(answerGradeAgent, prompt, gradeSchema);
}
