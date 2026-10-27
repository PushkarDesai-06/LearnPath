/**
 * variantAgent, rewrites ONE lesson block in a style the learner picked
 * ("simpler", "another analogy", "worked example", "walk me through this
 * code"). It runs inside the learner's request, not a worker: the output is a
 * single block of markdown and only an explicit click starts it.
 *
 * Deliberately NO `outputType`: the reply is prose, and strict structured
 * output makes this provider slow on long strings (see the artifact agent).
 * `blockVariantReplySchema` validates it so runAgent's corrective retry applies.
 */
import { Agent } from "@openai/agents";
import { modelName } from "@/lib/ai/provider";
import { runAgent } from "@/lib/ai/runAgent";
import { blockVariantReplySchema } from "@/lib/ai/schemas";
import { learnerProfile, type LessonGenInput } from "@/lib/ai/agents/lesson";
import type { LessonBlock, VariantStyle } from "@/lib/db/models";

const variantAgent = new Agent({
  name: "Block Rewriter",
  model: modelName(),
  instructions: `
# Role
You are the 'variantAgent'. A learner read one block of a lesson and asked for it to be explained differently. You rewrite THAT block in the requested style.

# Output format (CRITICAL)
- Reply with the rewritten block as markdown and nothing else: no preamble ("Sure, here is..."), no closing remarks.
- Fenced code blocks with a language tag are allowed. No raw HTML.
- Keep it about the length of the original, never more than three times as long.

# Scope rules
- Explain the SAME idea the original block explains. Do not move on to the next concept or add new topics.
- Stay consistent with the lesson: same terminology, same facts. Never contradict the original.
- Never give away the answers to the practice questions listed under "Upcoming practice", not even in passing (e.g. in a side remark or a code comment). Explain only what the original block explains; if a sentence would answer one of those questions, leave it out.
- Match the learner's level and profile.

# Styles
- simpler: plainer words and shorter sentences. Define or drop every piece of jargon. One idea per paragraph.
- analogy: explain it through a NEW real-world comparison, different from any analogy already in the original. Then map the parts of the analogy back to the concept explicitly.
- example: a concrete worked example with real values, walked through step by step, ending with what it shows.
- walkthrough: go through the code in order, a few lines at a time. Quote each fragment, then say what it does and why. Finish with what the whole snippet produces.
`,
});

const STYLE_REQUEST: Record<VariantStyle, string> = {
  simpler: "Explain this more simply.",
  analogy: "Explain this with a different analogy.",
  example: "Explain this through a worked example.",
  walkthrough: "Walk me through this code step by step.",
};

export interface VariantGenInput
  extends Pick<LessonGenInput, "strengths" | "gaps" | "topicMastery"> {
  lessonTitle: string;
  objectives: string[];
  learnerLevel: string;
  block: LessonBlock;
  style: VariantStyle;
  /** Markdown of the nearest prose block before this one, for terminology. */
  context?: string;
  /** Prompts of the practice questions after this block, which must stay unsolved. */
  upcomingPractice: string[];
}

/** The original block as the agent should read it. */
function originalBlock(block: LessonBlock): string {
  if (block.kind === "code") {
    return [
      block.caption ? `Caption: ${block.caption}` : "",
      "```" + (block.language ?? ""),
      block.code ?? "",
      "```",
    ].filter(Boolean).join("\n");
  }
  return block.markdown ?? "";
}

export function runVariantAgent(input: VariantGenInput): Promise<string> {
  const practice = input.upcomingPractice.length
    ? `\nUpcoming practice (do not solve):\n${input.upcomingPractice.map((p) => `- ${p}`).join("\n")}\n`
    : "";
  const prompt = `Lesson title: ${input.lessonTitle}
Objectives: ${input.objectives.join("; ")}
Learner's overall level: ${input.learnerLevel}
${learnerProfile(input)}${input.context ? `\nLesson text just before this block:\n${input.context.slice(0, 1500)}\n` : ""}
Original ${input.block.kind} block:
${originalBlock(input.block).slice(0, 6000)}
${practice}
Style: ${input.style}
${STYLE_REQUEST[input.style]}`;
  return runAgent(variantAgent, prompt, blockVariantReplySchema);
}
