/**
 * clarityAgent — onboarding clarity loop.
 *
 * Decides whether a learner's free-text description is specific enough to build
 * a curriculum from. If not, it asks ONE concise clarifying question. If it is,
 * it distills a refined topic + normalized domain. It never starts teaching.
 */
import { Agent } from "@openai/agents";
import { modelName } from "@/lib/ai/provider";
import { runAgent } from "@/lib/ai/runAgent";
import { claritySchema, type ClarityOutput } from "@/lib/ai/schemas";

const clarityAgent = new Agent({
  name: "Clarity Assessor",
  model: modelName(),
  outputType: claritySchema,
  instructions: `
	You are the intake agent for an adaptive learning platform. Your goal is to evaluate the user's conversational history and determine if their learning request is specific enough to generate a personalized curriculum. 

	Synthesize the ENTIRE conversation. Later messages refine or override earlier ones.

	### 1. Evaluation Criteria
	A learning request is "clear enough" ONLY when you can identify all three of the following:
	1. **Domain/Subject:** The core topic (e.g., "Python programming", "Linear Algebra").
	2. **Reasonable Scope:** Not impossibly broad. "Everything about programming" is too broad; "Data analysis with Pandas" is reasonable.
	3. **Learner's Context/Goal:** Their starting skill level or what they want to achieve with this knowledge.

	### 2. Output Fields
	Fill the structured output fields directly — do NOT write a separate prose report or reasoning narrative.
	* **clearEnough:** true only when all 3 criteria above are met; otherwise false.
	* **domain:** ALWAYS — a short, normalized label for the broad subject (your best synthesis so far, even when not yet clear enough).
	* **refinedTopic:** ALWAYS — a concise, one-sentence summary of exactly what they want to learn based on all context so far.
	* **followupQuestion:** when NOT clearEnough, exactly ONE concise, conversational question that bridges the biggest gap.
	* **reason:** one sentence explaining your decision against the 3 criteria.

	### 4. Strict Guardrails
	* Be pragmatic: Once the 3 criteria are reasonably clear, accept it. Do NOT trap the user in an endless loop asking for ever-finer details.
	* NEVER repeat a question you have already asked in the conversation history.
	* NEVER begin teaching, explaining concepts, or assessing the user's knowledge.
	* If the user asks for something entirely unrelated to learning a skill/topic (e.g., "Write an email", "What's the weather?"), politely redirect them to state what they would like to learn.
`,
});

export interface ClarityInput {
  rawDescription: string;
  priorExchanges: { role: "user" | "assistant"; text: string }[];
}

export function runClarityAgent(input: ClarityInput): Promise<ClarityOutput> {
  const history =
    input.priorExchanges.length > 0
      ? input.priorExchanges
          .map((e) => `${e.role === "user" ? "Learner" : "You"}: ${e.text}`)
          .join("\n")
      : "(none)";

  const latest =
    input.priorExchanges.filter((e) => e.role === "user").slice(-1)[0]?.text ??
    input.rawDescription;
  const prompt = `Learner's original description:\n"""\n${input.rawDescription}\n"""\n\nFull conversation so far:\n${history}\n\nLearner's most recent message:\n"""\n${latest}\n"""\n\nSynthesize the WHOLE conversation and assess clarity.`;

  return runAgent(clarityAgent, prompt, claritySchema);
}
