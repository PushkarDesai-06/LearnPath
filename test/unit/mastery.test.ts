import { describe, it, expect } from "vitest";
import {
  MASTERY_ALPHA,
  MASTERED_THRESHOLD,
  REVIEW_THRESHOLD,
  updateMastery,
  lessonStatusFor,
  isLessonDone,
} from "@/lib/domain/mastery";
import type { CurriculumLesson } from "@/lib/db/models";

describe("updateMastery (EWMA)", () => {
  it("blends previous and new with MASTERY_ALPHA", () => {
    // alpha*outcome + (1-alpha)*prev
    expect(updateMastery(0, 1)).toBeCloseTo(MASTERY_ALPHA, 10);
    expect(updateMastery(1, 0)).toBeCloseTo(1 - MASTERY_ALPHA, 10);
    expect(updateMastery(0.4, 0.8)).toBeCloseTo(
      MASTERY_ALPHA * 0.8 + (1 - MASTERY_ALPHA) * 0.4,
      10,
    );
  });

  it("clamps the outcome into [0,1] before blending", () => {
    expect(updateMastery(0.5, 5)).toBeCloseTo(updateMastery(0.5, 1), 10);
    expect(updateMastery(0.5, -3)).toBeCloseTo(updateMastery(0.5, 0), 10);
  });

  it("is idempotent when prev equals outcome", () => {
    expect(updateMastery(0.7, 0.7)).toBeCloseTo(0.7, 10);
  });

  it("stays within [0,1] for valid prev/outcome", () => {
    for (const prev of [0, 0.3, 0.6, 1]) {
      for (const out of [0, 0.5, 1]) {
        const v = updateMastery(prev, out);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("lessonStatusFor", () => {
  it("returns mastered at or above the mastered threshold", () => {
    expect(lessonStatusFor(MASTERED_THRESHOLD, false)).toBe("mastered");
    expect(lessonStatusFor(0.95, true)).toBe("mastered");
  });

  it("returns needs_review only when completed and below the review threshold", () => {
    expect(lessonStatusFor(REVIEW_THRESHOLD - 0.1, true)).toBe("needs_review");
    // not completed yet -> not flagged for review
    expect(lessonStatusFor(REVIEW_THRESHOLD - 0.1, false)).toBe("in_progress");
  });

  it("returns in_progress for the middle band", () => {
    expect(lessonStatusFor(0.5, true)).toBe("in_progress");
    expect(lessonStatusFor(0.5, false)).toBe("in_progress");
  });
});

describe("isLessonDone", () => {
  const lesson = (status: CurriculumLesson["status"]): CurriculumLesson => ({
    id: "l1",
    title: "t",
    objectives: [],
    order: 0,
    estMinutes: 10,
    difficultyLevel: "beginner",
    topics: [],
    contentGenerated: false,
    status,
    masteryScore: 0,
  });

  it("is true only for mastered lessons", () => {
    expect(isLessonDone(lesson("mastered"))).toBe(true);
    for (const s of [
      "locked",
      "available",
      "in_progress",
      "needs_review",
    ] as const) {
      expect(isLessonDone(lesson(s))).toBe(false);
    }
  });
});
