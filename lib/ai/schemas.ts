/**
 * Zod schemas describing the JSON each agent must return. We parse model
 * replies against these in runAgentStructured, so schemas can use plain
 * `.optional()` freely (we are not relying on provider strict-mode).
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
  refinedTopic: z.string().optional(),
  domain: z.string().optional(),
  followupQuestion: z.string().optional(),
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
export const lessonBlockSchema = z.object({
  kind: z.enum(["text", "code", "analogy", "example", "practice"]),
  markdown: z.string().optional(),
  language: z.string().optional(),
  code: z.string().optional(),
  caption: z.string().optional(),
  prompt: z.string().optional(),
  type: z.enum(["mcq", "short"]).optional(),
  choices: z.array(z.string()).optional(),
  correctKey: z.string().optional(),
  rubric: z.string().optional(),
  explanation: z.string().optional(),
});
export const lessonContentSchema = z.object({
  blocks: z.array(lessonBlockSchema),
});
export type LessonContentOutput = z.infer<typeof lessonContentSchema>;

// --- Socratic tutor ---
export const tutorSchema = z.object({
  reply: z.string(),
  gaveDirectAnswer: z.boolean(),
});
export type TutorOutput = z.infer<typeof tutorSchema>;
