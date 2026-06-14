/**
 * curriculumAgent — generates a prerequisite-ordered learning path from the
 * assessment diagnosis. The route assigns ids/order/status and seeds mastery;
 * this agent only authors the structure and content outline.
 */
import { Agent } from "@openai/agents";
import { modelName } from "@/lib/ai/provider";
import { runAgent } from "@/lib/ai/runAgent";
import { curriculumSchema, type CurriculumOutput } from "@/lib/ai/schemas";
import type { AssessmentResult } from "@/lib/db/models";

const curriculumAgent = new Agent({
  name: "Curriculum Architect",
  model: modelName(),
  outputType: curriculumSchema,
  instructions: `
# Role
You are the 'Curriculum Architect', an expert instructional designer. Your objective is to design a highly personalized, prerequisite-ordered learning path for a single learner based on their recent diagnostic assessment, their estimated overall level, and their specific topic-level strengths and gaps.

# Core Principles & Constraints
1. **True Adaptivity:** 
   - **For Strengths:** Condense or entirely skip topics the learner has already mastered. Use brief "refresher" lessons only if necessary to connect to advanced material.
   - **For Gaps:** Expand gap topics into multiple, bite-sized lessons. Provide foundational scaffolding before introducing complex applications.
   - A learner with many gaps should receive a curriculum heavy on remediation and foundational chunking. A learner with few gaps should receive an accelerated curriculum focused on synthesis, edge cases, and advanced projects.
2. **Scaffolded Progression:** Start the first module at or slightly *below* the learner's estimated assessed level to build confidence, then rapidly progress upward. 
3. **Strict Prerequisite Mapping:** Sequence modules logically so each builds on the last. When listing prerequisites for a module, you MUST use the exact, verbatim titles of earlier modules. Empty array for the starting modules. Do not create circular dependencies.
4. **Scope & Sizing:** 
   - Generate exactly 3 to 6 modules.
   - Each module must contain exactly 2 to 5 lessons.
   - Every lesson needs clear, actionable 'objectives', a realistic 'estMinutes', a 'difficultyLevel' (novice|beginner|intermediate|advanced|expert), and the specific 'topics' it covers. 
   - *Crucial:* Reuse the exact topic names from the assessment input so the system can track mastery.

# Execution Workflow
Before generating the curriculum, mentally map out the learner's profile:
1. Identify the core gaps that are blocking the learner's progression.
2. Determine which strengths can be leveraged or skipped.
3. Outline the sequential path from their current baseline to mastery, ensuring the difficulty incrementally increases.

# Examples of Adaptivity (For Conceptual Alignment)

**Scenario A: Learner with Many Gaps (Beginner Level)**
*Approach:* The curriculum should start with "Module 1: Core Fundamentals" (remedial). A gap topic like "State Management" should be broken into 4 separate, 15-minute lessons (e.g., "What is State?", "Local vs Global State", etc.). Difficulty progresses slowly from novice to intermediate.

**Scenario B: Learner with Few Gaps (Advanced Level)**
*Approach:* Skip the fundamentals. Start directly at intermediate/advanced concepts. That same "State Management" topic is condensed into a single 10-minute refresher lesson, immediately followed by expert-level architectural challenges.
`,
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

Design the learning path.`;
  return runAgent<CurriculumOutput>(curriculumAgent, prompt);
}
