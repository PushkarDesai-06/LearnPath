/**
 * lessonAgent, authors a single lesson's content as a sequence of blocks:
 * explanation, a concrete example, an analogy, code where relevant, at least
 * two embedded practice questions with explanations, and — only when the
 * concept benefits from it — one `interactive` block whose `spec` the artifact
 * agent later turns into a sandboxed HTML demo (see lib/jobs/artifactWorker.ts).
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
	- **For 'mcq':** Provide 3-4 choices. Ensure distractors represent common misconceptions. The 'correctKey' must be a STRING containing the zero-based index of the correct choice (e.g. "2" for the third choice). It MUST be a valid index into 'choices' — a whole number from "0" up to one less than the number of choices — never the answer text or an out-of-range index. (The output schema cannot enforce this range, so an invalid key gets the lesson rejected.)
	- **For 'short' (Free-text):** Provide a strict, objective 'rubric' defining exactly what a correct answer must contain so the grading agent can evaluate it fairly.
	- **'interactive':** (OPTIONAL — at most ONE per lesson) A hands-on visual demo the learner can manipulate, built later from your 'spec'.
	- Include it ONLY when the concept is visual, spatial, dynamic or parameter-driven (e.g. an algorithm stepping through data, a function whose shape changes with a parameter, a state machine, a data structure being modified, a physical relationship). Omit it for definitional, historical or purely conceptual lessons — most lessons need none.
	- 'caption': a short title for the demo (e.g. "Binary search, step by step").
	- 'spec': a concise brief, NOT code, with these parts: Concept (what it shows); Controls (what the learner changes — sliders, buttons, inputs); Behaviour (what updates in response); Takeaway (the insight they should notice). Where the learner has listed gaps on this lesson's topics, aim the demo at them.
	- Place it directly after the 'text' block that introduces the concept it illustrates.

	# Execution Constraints
	- Generate exactly **6 to 12 total blocks** (an 'interactive' block counts toward this).
	- You MUST open the lesson with a 'text' block.
	- You MUST include at least **one 'example' block** and **one 'analogy' block**.
	- You MUST include at least **two 'practice' blocks**, spread strategically throughout the lesson.
	- 'practice' blocks should include the questions in the 'prompt' tag.

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
  /** From the assessment result; optional so older curricula still work. */
  strengths?: string[];
  gaps?: string[];
  /** Mastery (0..1) for this lesson's topics only. */
  topicMastery?: { topic: string; score: number }[];
}

/** Assessment-derived profile lines, shared with the artifact agent's prompt. */
export function learnerProfile(
  input: Pick<LessonGenInput, "strengths" | "gaps" | "topicMastery">,
): string {
  const lines: string[] = [];
  if (input.strengths?.length) lines.push(`Learner strengths: ${input.strengths.join("; ")}`);
  if (input.gaps?.length) lines.push(`Learner gaps: ${input.gaps.join("; ")}`);
  if (input.topicMastery?.length) {
    lines.push(
      `Learner mastery on these topics: ${input.topicMastery
        .map((m) => `${m.topic} ${Math.round(m.score * 100)}%`)
        .join(", ")}`,
    );
  }
  return lines.length ? `${lines.join("\n")}\n` : "";
}

export function runLessonAgent(
  input: LessonGenInput,
): Promise<LessonContentOutput> {
  const prompt = `Lesson title: ${input.lessonTitle}
Objectives: ${input.objectives.join("; ")}
Topics covered: ${input.topics.join(", ")}
Lesson difficulty: ${input.difficultyLevel}
Learner's overall level: ${input.learnerLevel}
${learnerProfile(input)}
Write the lesson.`;
  return runAgent(lessonAgent, prompt, lessonContentSchema);
}
