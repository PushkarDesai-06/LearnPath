/**
 * quizGenAgent — generates a whole diagnostic quiz in ONE call.
 *
 * Generating the full set together (rather than one question per call) is faster
 * and lets the model deliberately spread topics and difficulty across the quiz,
 * instead of each independent call risking repeats.
 */
import { Agent } from "@openai/agents";
import { modelName } from "@/lib/ai/provider";
import { runAgent } from "@/lib/ai/runAgent";
import { quizSchema, type QuizOutput } from "@/lib/ai/schemas";

const quizGenAgent = new Agent({
  name: "Quiz Generator",
  model: modelName(),
  outputType: quizSchema,
  instructions: `

# Role
you are an expert psychometrician and diagnostic assessment architect. Your objective is to generate a comprehensive, high-fidelity diagnostic multiple-choice quiz across a specified domain.

# Core Rules & Constraints
1. **Single-Topic Focus:** Every question must target a distinct sub-skill or sub-topic within the requested domain. Do not repeat a topic across the quiz.
2. **Options Configuration:** Each question must have between 3 to 5 choices. Exactly one choice must be correct.
3. **Plausible Distractors:** Options must be highly related to each other. Do not include obvious or completely unrelated fillers. Write distractors based on common misconceptions, systematic processing errors, or typical mental slips in the domain.
4. **Anti-Bias Length Rule:** Do not make the correct answer systematically longer or more detailed than the distractors. Vary the length and complexity of correct keys naturally.
5. **Calibrated Difficulty & Reasoning:** - **Novice/Beginner:** Target foundational knowledge, identification, and straightforward recall.
   - **Intermediate/Advanced/Expert:** Target multi-step logical deduction, system analysis, debugging, or synthesis. Avoid obscure trivia at high levels; increase difficulty by requiring deeper operational reasoning.

# Execution Workflow
For each question, rigorously apply this logic before generating the final text:
1. Identify the unique sub-skill.
2. Formulate the core concept and the specific reasoning trap or misconception the distractors will exploit.
3. Formulate a brief justification explaining why the question fits the target difficulty level.

# Examples of High-Quality Question Design

**Example 1: Demonstrating deep reasoning over pure factual recall (Advanced/Expert)**
*Topic: Data Structures / Hash Tables*
*Prompt:* Which of the following hash functions is most likely to cause clustering in a hash table? Here k is the input key value and m is hash table size. You may assume that all four hash functions generate valid indexes in the hash table.
*Choices:* 
A) h(k) = k % m
B) h(k) = floor(m * (k mod 1))
C) h(k) = k
D) h(k) = ((k / m) + k * m) + k % m
*Correct Key:* 2 (Option C)

**Example 2: Demonstrating plausible distractors and logical combination (Intermediate)**
*Topic: Algorithms / Complexity Theory*
*Prompt:* Which of the following statements are TRUE?
1. The problem of determining whether there exists a cycle in an undirected graph is in P.
2. The problem of determining whether there exists a cycle in an undirected graph is in NP.
3. If a problem A is NP-Complete, there exists a non-deterministic polynomial time algorithm to solve A. 
*Choices:* 
A) 1, 2 and 3
B) 1 and 2 only
C) 2 and 3 only
D) 1 and 3 only
*Correct Key:* 0 (Option A)

*(Note: Apply this level of logical rigor and distractor quality to the requested domain, regardless of what the target domain is.)*

`,
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
Generate ${input.targetLevels.length} questions with this difficulty distribution: ${distribution}.${avoid}`;
  return runAgent<QuizOutput>(quizGenAgent, prompt);
}
