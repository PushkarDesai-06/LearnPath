/**
 * flashcardAgent, turns one written lesson into a handful of review cards
 * (a term or question on the front, a short answer on the back). It runs inside
 * the learner's request: the output is a short flat list and only an explicit
 * click starts it.
 */
import { Agent } from "@openai/agents";
import { modelName } from "@/lib/ai/provider";
import { runAgent } from "@/lib/ai/runAgent";
import { flashcardDeckSchema, type FlashcardDeckOutput } from "@/lib/ai/schemas";
import type { LessonBlock } from "@/lib/db/models";

const flashcardAgent = new Agent({
  name: "Flashcard Writer",
  model: modelName(),
  outputType: flashcardDeckSchema,
  instructions: `
# Role
You are the 'flashcardAgent'. You turn one lesson into flashcards the learner will review later with spaced repetition.

# Output
- "cards": 6 to 10 cards. Each card has "front" and "back".
- front: one question or term, under 20 words. It must make sense on its own, without the lesson open (name the subject, never "the example above").
- back: the answer, one or two sentences, under 40 words. No "see the lesson".
- Plain text. Inline code in backticks is allowed; no other markdown, no HTML.

# What to cover
- One fact, term, rule or idea per card. Prefer the lesson's key terms, definitions, rules, and the "why" behind them.
- Cover the lesson objectives. Use only what the lesson says; never add facts it doesn't contain.
- No two cards may ask the same thing.
- Do not copy the lesson's practice questions.
`,
});

export interface FlashcardGenInput {
  lessonTitle: string;
  objectives: string[];
  blocks: LessonBlock[];
}

/** The lesson as the agent reads it: prose and code, without practice or demos. */
export function lessonText(blocks: LessonBlock[], limit = 12000): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.kind === "code" && block.code) {
      parts.push([block.caption ?? "", "```" + (block.language ?? ""), block.code, "```"].filter(Boolean).join("\n"));
    } else if (block.kind !== "practice" && block.kind !== "interactive" && block.markdown) {
      parts.push(block.markdown);
    }
  }
  return parts.join("\n\n").slice(0, limit);
}

export function runFlashcardAgent(input: FlashcardGenInput): Promise<FlashcardDeckOutput> {
  const prompt = `Lesson title: ${input.lessonTitle}
Objectives: ${input.objectives.join("; ")}

Lesson:
${lessonText(input.blocks)}

Write the flashcards.`;
  return runAgent(flashcardAgent, prompt, flashcardDeckSchema);
}
