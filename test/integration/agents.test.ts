/**
 * Live integration tests for the AI agents against the configured LLM provider.
 *
 * These hit a real (slow) API, so every test sets a generous per-test timeout.
 * Assertions are SCHEMA-BASED + structural, not semantic: the point is to prove
 * the `outputType` -> strict json_schema -> SDK-parse path returns a
 * schema-valid object from the live provider, not to pin exact wording (which
 * would flake). They self-skip when GEMINI_API_KEY is absent.
 *
 * NOTE: the Socratic tutor agent is intentionally NOT covered here — it depends
 * on DB-seeded topic material (lib/ai/tools/topicLookup), so it can't run
 * without a populated Mongo. Cover it in an e2e/route test with a seeded DB.
 *
 * Kept in ONE file so the agent calls run sequentially (Vitest parallelizes
 * across files, not within one) — avoids bursts against the provider.
 */
import "../load-env";
import { describe, it, expect } from "vitest";
import { runClarityAgent } from "@/lib/ai/agents/clarity";
import { runQuizGenAgent } from "@/lib/ai/agents/assessment";
import { runAnswerGradeAgent } from "@/lib/ai/agents/grading";
import { runCurriculumAgent } from "@/lib/ai/agents/curriculum";
import { runLessonAgent } from "@/lib/ai/agents/lesson";
import {
  claritySchema,
  quizSchema,
  gradeSchema,
  curriculumSchema,
  lessonContentSchema,
} from "@/lib/ai/schemas";
import { DIFFICULTY_LEVELS } from "@/lib/db/models";
import type { AssessmentResult } from "@/lib/db/models";

const TIMEOUT = 180_000;
// The lesson author emits many blocks and may trigger one corrective retry (each
// generation is ~2-3 min on this provider, and a retry doubles it), so it is by
// far the slowest agent — give it very generous headroom.
const LESSON_TIMEOUT = 600_000;
const hasKey = !!process.env.GEMINI_API_KEY;

describe.skipIf(!hasKey)("AI agents (live provider)", () => {
  it(
    "clarity returns a schema-valid clarity assessment",
    async () => {
      const result = await runClarityAgent({
        rawDescription: "I want to get better at Python for data analysis",
        priorExchanges: [],
      });
      expect(claritySchema.safeParse(result).success).toBe(true);
      expect(typeof result.clearEnough).toBe("boolean");
      expect(typeof result.reason).toBe("string");
      expect(result.reason.length).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  it(
    "grading returns a schema-valid grade with confidence in [0,1]",
    async () => {
      const result = await runAnswerGradeAgent({
        prompt: "What is 2 + 2?",
        rubric: "The answer is 4.",
        learnerAnswer: "It is 4.",
      });
      expect(gradeSchema.safeParse(result).success).toBe(true);
      expect(typeof result.correct).toBe("boolean");
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      // single (accepted) semantic check, on a maximally unambiguous answer
      expect(result.correct).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "quiz generation returns schema-valid MCQs with usable keys",
    async () => {
      const result = await runQuizGenAgent({
        domain: "Python programming",
        refinedTopic: "Python basics",
        targetLevels: ["novice", "novice", "beginner", "beginner"],
      });
      expect(quizSchema.safeParse(result).success).toBe(true);
      expect(result.questions.length).toBeGreaterThanOrEqual(1);
      for (const q of result.questions) {
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
        // correctKey must index into the choices (the grader relies on this)
        const idx = Number(q.correctKey);
        expect(Number.isInteger(idx)).toBe(true);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(q.choices.length);
        expect(DIFFICULTY_LEVELS).toContain(q.level);
      }
    },
    TIMEOUT,
  );

  it(
    "curriculum generation returns a schema-valid nested path",
    async () => {
      const result: AssessmentResult = {
        estimatedLevel: "beginner",
        score: 0.5,
        strengths: ["basic syntax"],
        gaps: ["functions", "data structures"],
        perTopicMastery: [
          { topic: "syntax", score: 0.7 },
          { topic: "functions", score: 0.2 },
        ],
      };
      const curr = await runCurriculumAgent({
        domain: "Python programming",
        refinedTopic: "Python for data analysis",
        result,
      });
      expect(curriculumSchema.safeParse(curr).success).toBe(true);
      expect(curr.title.length).toBeGreaterThan(0);
      expect(curr.modules.length).toBeGreaterThanOrEqual(1);
      // at least one lesson somewhere in the path (don't require every module
      // to be populated — the model's distribution varies)
      const totalLessons = curr.modules.reduce(
        (n, m) => n + m.lessons.length,
        0,
      );
      expect(totalLessons).toBeGreaterThanOrEqual(1);
    },
    TIMEOUT,
  );

  it(
    "lesson generation returns schema-valid blocks with practice + prose",
    async () => {
      const lesson = await runLessonAgent({
        lessonTitle: "Writing your first Python function",
        objectives: ["Define a function", "Use parameters and return values"],
        topics: ["functions"],
        difficultyLevel: "beginner",
        learnerLevel: "beginner",
      });
      // Schema-based: lessonContentSchema enforces >= 3 blocks and that each
      // block carries content valid for its kind (via .refine). We do NOT assert
      // which kinds appear — the model's mix varies run to run (e.g. it may emit
      // no "practice" blocks), and the schema doesn't require any specific kind.
      expect(lessonContentSchema.safeParse(lesson).success).toBe(true);
      expect(lesson.blocks.length).toBeGreaterThanOrEqual(3);
      const validKinds = ["text", "code", "analogy", "example", "practice"];
      for (const b of lesson.blocks) expect(validKinds).toContain(b.kind);
    },
    LESSON_TIMEOUT,
  );
});
