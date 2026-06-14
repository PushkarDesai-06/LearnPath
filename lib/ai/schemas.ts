/**
 * Zod schemas describing the JSON each agent must return. These are attached to
 * the agents as `outputType`, so the Agents SDK sends them as the model's
 * structured `response_format` and validates the reply against them for us.
 *
 * The SDK forces strict structured output, which makes every property required;
 * models routinely fill a field they have nothing for with an explicit `null`.
 * Optional fields therefore use `.nullish()` (accept null OR absent) rather than
 * `.optional()` — the SDK parses the reply with no null-stripping, so a plain
 * `.optional()` would reject those nulls and throw.
 *
 * Keep these flat/shallow — the more nested the shape, the more often a model
 * drifts from it.
 */
import { z } from "zod";
import { DIFFICULTY_LEVELS } from "@/lib/db/models";

export const difficultyEnum = z.enum(
  DIFFICULTY_LEVELS as [string, ...string[]],
);

// --- onboarding clarity ---
export const claritySchema = z.object({
  clearEnough: z.boolean(),
  refinedTopic: z.string().nullish(),
  domain: z.string().nullish(),
  followupQuestion: z.string().nullish(),
  reason: z.string(),
});
export type ClarityOutput = z.infer<typeof claritySchema>;

// --- assessment question generation (legacy, single-question) ---
export const questionSchema = z.object({
  topic: z.string(),
  type: z.enum(["mcq", "short"]),
  prompt: z.string(),
  choices: z.array(z.string()).optional(),
  correctKey: z.string().optional(), // index as string for mcq, e.g. "0"
  rubric: z.string().optional(), // grading guidance for short answers
});
export type QuestionOutput = z.infer<typeof questionSchema>;

// --- batch quiz generation (whole quiz in one call, MCQ only) ---
export const quizQuestionSchema = z.object({
  topic: z.string(),
  level: difficultyEnum,
  prompt: z.string(),
  choices: z.array(z.string()).min(2),
  correctKey: z.string(), // zero-based index of the correct choice, e.g. "2"
});
export const quizSchema = z.object({
  questions: z.array(quizQuestionSchema),
});
export type QuizOutput = z.infer<typeof quizSchema>;

// --- answer grading (short answer) ---
export const gradeSchema = z.object({
  correct: z.boolean(),
  confidence: z.number().min(0).max(1),
  feedback: z.string(),
});
export type GradeOutput = z.infer<typeof gradeSchema>;

// --- curriculum generation ---
export const curriculumLessonSchema = z.object({
  title: z.string(),
  objectives: z.array(z.string()),
  estMinutes: z.number(),
  difficultyLevel: difficultyEnum,
  topics: z.array(z.string()),
});
export const curriculumModuleSchema = z.object({
  title: z.string(),
  summary: z.string(),
  prerequisites: z.array(z.string()), // titles of prerequisite modules
  lessons: z.array(curriculumLessonSchema),
});
export const curriculumSchema = z.object({
  title: z.string(),
  modules: z.array(curriculumModuleSchema),
});
export type CurriculumOutput = z.infer<typeof curriculumSchema>;

// --- lesson content generation ---
const lessonBlockBase = z.object({
  kind: z.enum(["text", "code", "analogy", "example", "practice"]),
  markdown: z.string().nullish(),
  language: z.string().nullish(),
  code: z.string().nullish(),
  caption: z.string().nullish(),
  prompt: z.string().nullish(),
  type: z.enum(["mcq", "short"]).nullish(),
  choices: z.array(z.string()).nullish(),
  correctKey: z.string().nullish(),
  rubric: z.string().nullish(),
  explanation: z.string().nullish(),
});

const nonEmpty = (v?: string | null) =>
  typeof v === "string" && v.trim().length > 0;

/**
 * A block must carry the content appropriate to its `kind`. Without this,
 * `{ "kind": "text" }` (no markdown) or a block whose content arrived under the
 * wrong field name (zod silently strips unknown keys) would pass as an EMPTY
 * block. Failing here makes runAgent retry with a corrective message.
 */
function blockHasContent(b: z.infer<typeof lessonBlockBase>): boolean {
  switch (b.kind) {
    case "text":
    case "analogy":
    case "example":
      return nonEmpty(b.markdown);
    case "code":
      return nonEmpty(b.code);
    case "practice":
      if (!nonEmpty(b.prompt)) return false;
      if (b.type === "mcq")
        return !!b.choices && b.choices.length >= 2 && nonEmpty(b.correctKey);
      if (b.type === "short") return nonEmpty(b.rubric);
      return false; // practice needs a valid type
    default:
      return false;
  }
}

export const lessonBlockSchema = lessonBlockBase.refine(blockHasContent, {
  message:
    'Each block must include its content. "text"/"analogy"/"example" need a non-empty "markdown"; ' +
    '"code" needs "code"; "practice" needs "prompt" + "type" ("mcq"|"short"), where "mcq" also needs ' +
    '"choices" (>=2) and "correctKey", and "short" also needs "rubric". Never emit a block with only "kind".',
});
export const lessonContentSchema = z.object({
  blocks: z.array(lessonBlockSchema).min(3),
});
export type LessonContentOutput = z.infer<typeof lessonContentSchema>;

// --- Socratic tutor ---
export const tutorSchema = z.object({
  reply: z.string(),
  gaveDirectAnswer: z.boolean(),
});
export type TutorOutput = z.infer<typeof tutorSchema>;
