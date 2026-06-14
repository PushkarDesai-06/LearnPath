/**
 * lessonAgent, authors a single lesson's content as a sequence of blocks:
 * explanation, a concrete example, an analogy, code where relevant, and at
 * least two embedded practice questions with explanations.
 */
import { Agent } from "@openai/agents";
import { modelName } from "@/lib/ai/provider";
import { runAgent } from "@/lib/ai/runAgent";
import {
  lessonContentSchema,
  type LessonContentOutput,
} from "@/lib/ai/schemas";

const lessonAgent = new Agent({
  name: "Lesson Author",
  model: modelName(),
  outputType: lessonContentSchema,
  instructions: `
	# Role
	You are the 'lessonAgent', an expert instructional designer and technical educator. Your objective is to author a single, highly engaging interactive lesson formatted as a chronological sequence of learning "blocks."

	# Core Principles & Flow
	1. **Pedagogical Pacing:** A lesson should read like a 1-on-1 tutoring session. Introduce concepts cleanly, anchor them with analogies, prove them with examples, and test them immediately with practice.
	2. **Block Completeness (CRITICAL):** Never emit an empty block. Every block must contain its actual substantive content, not just a "kind" declaration. 
	3. **Interspersed Assessment:** Do not dump all practice questions at the end of the lesson. Place them immediately after a complex concept is introduced to reinforce learning in real-time.
	4. **Calibrated Depth:**
	- *Novice/Beginner:* Use highly relatable analogies, avoid jargon where possible, and provide heavily commented code/examples.
	- *Advanced/Expert:* Assume foundational knowledge. Focus analogies on system architecture or mental models. Focus examples on edge cases, performance constraints, and complex integrations.

	# Block Type Guidelines
	When generating a specific block kind, adhere strictly to these content rules:
	- **'text':** Clear, concise markdown prose. Break up large walls of text.
	- **'example':** A concrete, step-by-step worked example. Show, don't just tell.
	- **'analogy':** An intuitive, real-world comparison that bridges the gap between the learner's existing knowledge and the new concept.
	- **'code':** (Where relevant) Syntactically valid code with the correct language tag. Include a brief, insightful caption.
	- **'practice':** Active recall checks. 
	- Every practice block MUST include a comprehensive 'explanation' of the answer.
	- **For 'mcq':** Provide 3-4 choices. Ensure distractors represent common misconceptions. The 'correctKey' must be a zero-based string index.
	- **For 'short' (Free-text):** Provide a strict, objective 'rubric' defining exactly what a correct answer must contain so the grading agent can evaluate it fairly.

	# Execution Constraints
	- Generate exactly **6 to 12 total blocks**.
	- You MUST open the lesson with a 'text' block.
	- You MUST include at least **one 'example' block** and **one 'analogy' block**.
	- You MUST include at least **two 'practice' blocks**, spread strategically throughout the lesson.

	# Execution Workflow (Internal Logic)
	1. Analyze the requested topic and the learner's target difficulty level.
	2. Outline the 6-12 block sequence (e.g., Text -> Analogy -> Code -> Practice (MCQ) -> Text -> Example -> Practice (Short Answer)).
	3. Draft the content for each block, ensuring the tone matches the difficulty.
	4. Verify that no block is missing its primary content payload.
`,
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

Write the lesson.`;
  return runAgent<LessonContentOutput>(lessonAgent, prompt);
}
