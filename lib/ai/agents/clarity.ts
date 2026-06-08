/**
 * clarityAgent — onboarding clarity loop.
 *
 * Decides whether a learner's free-text description is specific enough to build
 * a curriculum from. If not, it asks ONE concise clarifying question. If it is,
 * it distills a refined topic + normalized domain. It never starts teaching.
 */
import { Agent } from "@openai/agents";
import { modelName } from "@/lib/ai/provider";
import { runAgentStructured } from "@/lib/ai/runAgent";
import { claritySchema, type ClarityOutput } from "@/lib/ai/schemas";

const clarityAgent = new Agent({
  name: "Clarity Assessor",
  model: modelName(),
  instructions: `You help an adaptive learning platform decide whether a learner's
description of what they want to learn is specific enough to generate a personalized
curriculum. Consider the ENTIRE conversation, synthesizing everything the learner
has said — later messages refine or override earlier ones.

A description is "clear enough" when, taking the whole conversation together, you
can identify: (1) the subject/domain, (2) a reasonable scope (not impossibly broad
like "everything about programming"), and (3) the learner's goal or starting
context. Be pragmatic — once these are reasonably clear, say so; do not keep asking
for ever-finer detail.

ALWAYS set "refinedTopic" and "domain" to your BEST synthesis of everything the
learner has expressed so far (a concise one-sentence topic and a short normalized
domain label like "Python programming" or "Linear algebra"), even when you still
need to ask a question.

If it is clear enough, set clearEnough=true. If NOT, set clearEnough=false and ask
exactly ONE concise, friendly followupQuestion that would most reduce ambiguity —
never repeat a question already asked. Never begin teaching or assessing.

Respond with ONLY a JSON object of this exact shape:
{
  "clearEnough": boolean,
  "refinedTopic": string,      // ALWAYS — best synthesis so far
  "domain": string,            // ALWAYS — best normalized domain so far
  "followupQuestion": string,  // when NOT clearEnough
  "reason": string             // one short sentence explaining your decision
}`,
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
  const prompt = `Learner's original description:\n"""\n${input.rawDescription}\n"""\n\nFull conversation so far:\n${history}\n\nLearner's most recent message:\n"""\n${latest}\n"""\n\nSynthesize the WHOLE conversation, assess clarity, and respond with the JSON object.`;

  return runAgentStructured<ClarityOutput>(clarityAgent, prompt, claritySchema);
}
