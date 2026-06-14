import { describe, it, expect } from "vitest";
import {
  levelName,
  levelIndex,
  estimateLevelIdx,
  recommendAnotherRound,
  round2Levels,
  computeResult,
} from "@/lib/domain/assessment";
import { DIFFICULTY_LEVELS } from "@/lib/db/models";
import type { AssessmentDoc, AssessmentQuestion } from "@/lib/db/models";

function q(p: Partial<AssessmentQuestion>): AssessmentQuestion {
  return {
    id: p.id ?? "q",
    round: 1,
    levelIdx: 0,
    topic: "general",
    prompt: "prompt",
    type: "mcq",
    askedAt: new Date(0),
    ...p,
  };
}

/** N questions in one band, `correct` of them right; all answered. */
function band(levelIdx: number, n: number, correct: number, topic = "t") {
  return Array.from({ length: n }, (_, i) =>
    q({
      id: `${levelIdx}-${i}`,
      levelIdx,
      topic,
      answer: "0",
      correct: i < correct,
    }),
  );
}

const docOf = (questions: AssessmentQuestion[]) =>
  ({ questions }) as unknown as AssessmentDoc;

describe("levelName / levelIndex", () => {
  it("maps index to name and clamps out-of-range", () => {
    expect(levelName(0)).toBe("novice");
    expect(levelName(4)).toBe("expert");
    expect(levelName(-5)).toBe("novice");
    expect(levelName(99)).toBe("expert");
  });

  it("maps name (case-insensitive) to index, defaulting unknown to 1", () => {
    expect(levelIndex("novice")).toBe(0);
    expect(levelIndex("EXPERT")).toBe(4);
    expect(levelIndex("nonsense")).toBe(1);
  });

  it("levelName and levelIndex round-trip", () => {
    for (let i = 0; i < DIFFICULTY_LEVELS.length; i++) {
      expect(levelIndex(levelName(i))).toBe(i);
    }
  });
});

describe("estimateLevelIdx (highest contiguously-passed band)", () => {
  it("returns the top band when every band passes", () => {
    const qs = [...band(0, 2, 2), ...band(1, 2, 2), ...band(2, 2, 2)];
    expect(estimateLevelIdx(qs)).toBe(2);
  });

  it("stops at the band before the first failure", () => {
    const qs = [...band(0, 2, 2), ...band(1, 2, 2), ...band(2, 2, 0)];
    expect(estimateLevelIdx(qs)).toBe(1);
  });

  it("returns 0 when the lowest band fails", () => {
    const qs = [...band(0, 2, 0), ...band(1, 2, 2)];
    expect(estimateLevelIdx(qs)).toBe(0);
  });

  it("treats exactly 50% as a pass", () => {
    expect(estimateLevelIdx(band(0, 2, 1))).toBe(0); // 50% passes band 0
    const qs = [...band(0, 2, 1), ...band(1, 2, 1)];
    expect(estimateLevelIdx(qs)).toBe(1);
  });
});

describe("recommendAnotherRound (non-monotonic = noisy)", () => {
  it("is false for monotonic results (pass low, fail high)", () => {
    const qs = [...band(0, 2, 2), ...band(1, 2, 2), ...band(2, 2, 0)];
    expect(recommendAnotherRound(qs)).toBe(false);
  });

  it("is true when a lower band fails but a higher one passes", () => {
    const qs = [...band(0, 2, 0), ...band(2, 2, 2)];
    expect(recommendAnotherRound(qs)).toBe(true);
  });

  it("is false when nothing was answered", () => {
    expect(recommendAnotherRound([])).toBe(false);
  });
});

describe("round2Levels", () => {
  it("centers a focused band on the estimate, clamped to range", () => {
    expect(round2Levels(0)).toEqual([0, 0, 0, 1]);
    expect(round2Levels(2)).toEqual([1, 2, 2, 3]);
    expect(round2Levels(4)).toEqual([3, 4, 4, 4]);
  });
});

describe("computeResult", () => {
  it("computes score, level, per-topic mastery, strengths and gaps", () => {
    const qs = [
      ...band(0, 2, 2, "arrays"), // 100% -> strength
      ...band(1, 2, 1, "loops"), // 50%  -> neither
      ...band(2, 2, 0, "recursion"), // 0%  -> gap, and fails band 2
    ];
    const result = computeResult(docOf(qs));

    expect(result.score).toBeCloseTo(3 / 6, 10);
    expect(result.estimatedLevel).toBe("beginner"); // est idx 1
    expect(result.strengths).toContain("arrays");
    expect(result.gaps).toContain("recursion");
    expect(result.gaps).not.toContain("loops");

    const arrays = result.perTopicMastery.find((t) => t.topic === "arrays");
    expect(arrays?.score).toBe(1);
  });

  it("ignores unanswered questions", () => {
    const qs = [
      ...band(0, 2, 2, "arrays"),
      q({ id: "x", levelIdx: 0, topic: "arrays" }), // no answer/correct
    ];
    const result = computeResult(docOf(qs));
    const arrays = result.perTopicMastery.find((t) => t.topic === "arrays");
    expect(arrays?.score).toBe(1); // unanswered one not counted
  });

  it("returns score 0 for an empty assessment", () => {
    const result = computeResult(docOf([]));
    expect(result.score).toBe(0);
    expect(result.perTopicMastery).toEqual([]);
  });
});
