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
  counts), and across DIFFERENT sub-skills ("topic"), do not repeat a topic.
- Keep prompts self-contained and unambiguous; calibrate difficulty to each level.
- Dont always make the correct answer the longest one.
- Keep the options related to each other dont give unrelated options as it is very easy to rule out.
- More the reasoning required for a question harder it is. Avoid fact based questions on higher level, having logical questions at that 
	difficulty makes more sense. If the topic is factual then it is okay to ask factual questions.
- 

Examples : 

	Question : Which of the following hash functions is most likely to cause clustering in a hash table? Here k is the input key value and m is hash table size. You may assume that all four hash functions generate valid indexes in the hash table.

	Options : 
		A) h(k) = k % m

		B) h(k) = floor(m * (k mod 1))

		C) h(k) = k

		D) h(k) = ((k / m) + k * m) + k % m


	Question : Which of the following statements are TRUE?

	1. The problem of determining whether there exists
	a cycle in an undirected graph is in P.
	2. The problem of determining whether there exists
	a cycle in an undirected graph is in NP.
	3. If a problem A is NP-Complete, there exists a 
	non-deterministic polynomial time algorithm to solve A. 
		A) 1, 2 and 3

		B) 1 and 2 only

		C) 2 and 3 only

		D) 1 and 3 only


IMPORTANT: Respond with ONLY a JSON object of this shape:
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
