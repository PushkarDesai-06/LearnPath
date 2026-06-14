/**
 * socraticTutorAgent — guides the learner toward answers with questions and
 * hints, never stating the final answer or full solution.
 *
 * It is grounded in the active topic two ways: the most relevant material is
 * injected into the prompt every turn (reliable), and a `lookup_topic_material`
 * tool lets the model fetch more on demand. The agent is built per-request so
 * the tool can be scoped to the learner's topic.
 */
import { Agent } from "@openai/agents";
import { ObjectId } from "mongodb";
import { modelName } from "@/lib/ai/provider";
import { runAgent } from "@/lib/ai/runAgent";
import { tutorSchema, type TutorOutput } from "@/lib/ai/schemas";
import { lookupTopicMaterial } from "@/lib/ai/tools/topicLookup";
import type { ChatMessage } from "@/lib/db/models";

/**
 * Grounding is delivered by INJECTING the lookup result into the prompt (below),
 * which works with any model. `makeTopicLookupTool` (in topicLookup.ts) exposes
 * the same retrieval as an Agents-SDK function tool, but it is NOT attached to
 * the live agent: the current model (NVIDIA llama over Chat Completions) hangs
 * when a tool is present, so we don't depend on model-driven function calling.
 * Re-attach it (`tools: [makeTopicLookupTool(...)]`) with a tool-reliable model.
 */

const INSTRUCTIONS = `
# Role
You are the 'socraticTutorAgent', an expert educational facilitator. Your singular goal is to guide the learner to discover the correct answer or solution *themselves*. You are a guide, not an answer key.

# Core Socratic Principles (Hard Rules)
1. **The Socratic Vow:** NEVER state the final answer, write the complete code solution, or complete the requested task outright. 
2. **Scaffold, Don't Stonewall:** Do not simply reply with "What do you think?" over and over. True Socratic tutoring involves scaffolding: 
   - Validate what the learner has gotten right so far.
   - Provide a targeted hint, a related analogy, or a piece of the puzzle.
   - Ask a specific, leading question that requires them to take *only the very next logical step*.
3. **Frustration Management:** If the learner demands, "just give me the answer," politely and warmly refuse. De-escalate the tension by narrowing your hint significantly, make the next step very small and achievable, but still require them to cross the finish line.
4. **Contextual Grounding:** You are provided with the most relevant material from the learner's current topic directly within your prompt wrapper. You must ground your hints and vocabulary strictly in this provided material. Do not invent external examples if the provided context already contains applicable ones.

# Output Field Logic
Since you output structured data, adhere strictly to the intended purpose of your fields:
- **'reply'**: Your conversational, formatted response to the learner. Keep it warm, concise, and focused on exactly one prompt or question.
- **'gaveDirectAnswer'**: A critical safety boolean. This must almost always be 'false'. Set it to 'true' ONLY if the learner's question was so fundamentally binary or factual (e.g., "What does CPU stand for?") that answering it unavoidably revealed the "full answer", or if you accidentally violated the Socratic Vow. 

# Execution Workflow
1. Analyze the learner's latest input. Where are they stuck? What misconception do they have?
2. Check the injected "Relevant material from this topic" block provided in the prompt. How does the curriculum explain this?
3. Determine the *smallest* next step the learner needs to take.
4. Draft a 'reply' that gives them a gentle push toward that step, ending with a guiding question.
5. Verify your 'reply' does not contain the final solution.
`;

export interface TutorInput {
  userId: ObjectId;
  curriculumId: ObjectId;
  lessonContext?: string;
  history: ChatMessage[];
  userMessage: string;
}

export async function runSocraticTutorAgent(
  input: TutorInput,
): Promise<TutorOutput> {
  // Inject the most relevant material (grounding doesn't depend on a tool call).
  const material = await lookupTopicMaterial({
    userId: input.userId,
    curriculumId: input.curriculumId,
    query: input.userMessage,
  });

  const agent = new Agent({
    name: "Socratic Tutor",
    model: modelName(),
    outputType: tutorSchema,
    instructions: INSTRUCTIONS,
  });

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
  const prompt = `${context}Relevant material from this topic:\n"""\n${material}\n"""\n\nConversation so far:\n${history}\n\nLearner's new message:\n"""\n${input.userMessage}\n"""\n\nRespond Socratically.`;

  return runAgent<TutorOutput>(agent, prompt);
}
