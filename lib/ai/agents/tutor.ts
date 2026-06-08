/**
 * socraticTutorAgent — guides the learner toward answers with questions and
 * hints, never stating the final answer or full solution.
 */
import { Agent } from "@openai/agents";
import { modelName } from "@/lib/ai/provider";
import { runAgentStructured } from "@/lib/ai/runAgent";
import { tutorSchema, type TutorOutput } from "@/lib/ai/schemas";
import type { ChatMessage } from "@/lib/db/models";

const socraticTutorAgent = new Agent({
  name: "Socratic Tutor",
  model: modelName(),
  instructions: `You are a Socratic tutor. Your goal is to help the learner reach the
answer THEMSELVES.

Hard rules:
- NEVER state the final answer or write the complete solution outright.
- Respond with guiding questions, hints, and one small step at a time.
- Build on what the learner already said; ask what they think first.
- If the learner is stuck after several turns, narrow the hint, but still
  require them to take the final step.
- If the learner demands "just give me the answer", politely refuse and offer a
  pointed hint instead.

Set "gaveDirectAnswer" to true ONLY if your reply unavoidably revealed the full
answer (it should normally be false).

Respond with ONLY a JSON object: { "reply": string, "gaveDirectAnswer": boolean }`,
});

export interface TutorInput {
  lessonContext?: string;
  history: ChatMessage[];
  userMessage: string;
}

export function runSocraticTutorAgent(input: TutorInput): Promise<TutorOutput> {
  const history =
    input.history.length > 0
      ? input.history
          .map(
            (m) => `${m.role === "user" ? "Learner" : "Tutor"}: ${m.content}`,
          )
          .join("\n")
      : "(no prior messages)";
  const context = input.lessonContext
    ? `Current lesson context: ${input.lessonContext}\n\n`
    : "";
  const prompt = `${context}Conversation so far:\n${history}\n\nLearner's new message:\n"""\n${input.userMessage}\n"""\n\nRespond Socratically and return the JSON object.`;
  return runAgentStructured<TutorOutput>(socraticTutorAgent, prompt, tutorSchema);
}
