/**
 * Unit tests for runLessonAgent's validation pipeline, with the LLM runner
 * MOCKED so they are deterministic and need no API key.
 *
 * The integration test (test/integration/agents.test.ts) proves the REAL agent
 * returns schema-valid JSON. This file proves the surrounding plumbing in
 * runAgent: that a schema-conforming reply is returned, that a refinement-
 * FAILING reply triggers exactly one corrective retry, and that two bad replies
 * surface a 502 ApiError instead of letting malformed lesson JSON through.
 *
 * The provider is mocked so importing lesson.ts (which calls modelName() at
 * module load and runAgent() at call time) touches no env vars or network.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoisted so the vi.mock factory below can close over it (vi.mock is hoisted
// above the imports). Each test programs this to stand in for `runner.run`.
const run = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/provider", () => ({
  modelName: () => "test-model",
  getRunner: () => ({ run }),
}));

import { runLessonAgent } from "@/lib/ai/agents/lesson";
import { lessonContentSchema } from "@/lib/ai/schemas";
import { ApiError } from "@/lib/http";

const INPUT = {
  lessonTitle: "Writing your first Python function",
  objectives: ["Define a function", "Use parameters and return values"],
  topics: ["functions"],
  difficultyLevel: "beginner",
  learnerLevel: "beginner",
};

// A schema-conforming lesson (>= 3 blocks, each carrying valid content).
const validLesson = {
  blocks: [
    { kind: "text", markdown: "Functions name and reuse logic." },
    { kind: "analogy", markdown: "A function is like a recipe." },
    {
      kind: "practice",
      type: "mcq",
      prompt: "What does return do?",
      choices: ["Prints", "Hands a value back", "Loops"],
      correctKey: "1",
      explanation: "return passes a value back to the caller.",
    },
  ],
};

// Same shape but the mcq's correctKey ("9") indexes no real choice, so it fails
// the blockHasContent refinement — a realistic "looks valid, isn't" model error.
const invalidLesson = {
  blocks: [
    { kind: "text", markdown: "Functions name and reuse logic." },
    { kind: "analogy", markdown: "A function is like a recipe." },
    {
      kind: "practice",
      type: "mcq",
      prompt: "What does return do?",
      choices: ["Prints", "Hands a value back", "Loops"],
      correctKey: "9",
      explanation: "out-of-range key",
    },
  ],
};

beforeEach(() => {
  run.mockReset();
});

describe("runLessonAgent — validation pipeline (mocked runner)", () => {
  it("returns the parsed lesson when the model's first reply conforms", async () => {
    run.mockResolvedValueOnce({ finalOutput: validLesson });

    const result = await runLessonAgent(INPUT);

    expect(run).toHaveBeenCalledTimes(1);
    expect(lessonContentSchema.safeParse(result).success).toBe(true);
    expect(result.blocks).toHaveLength(3);
  });

  it("retries once with a corrective prompt when the first reply fails the schema", async () => {
    run
      .mockResolvedValueOnce({ finalOutput: invalidLesson })
      .mockResolvedValueOnce({ finalOutput: validLesson });

    const result = await runLessonAgent(INPUT);

    expect(run).toHaveBeenCalledTimes(2);
    expect(lessonContentSchema.safeParse(result).success).toBe(true);

    // The retry input is the original prompt plus an actionable correction that
    // names the violation — not a verbatim re-send.
    const firstInput = run.mock.calls[0][1] as string;
    const retryInput = run.mock.calls[1][1] as string;
    expect(retryInput).not.toBe(firstInput);
    expect(retryInput).toContain("previous reply could not be used");
    expect(retryInput).toContain("correctKey");
    expect(retryInput).toContain(
      "output that matches the required schema exactly",
    );
  });

  it("throws a 502 ApiError when both replies fail the schema", async () => {
    run.mockResolvedValue({ finalOutput: invalidLesson });

    const error = await runLessonAgent(INPUT).catch((e: unknown) => e);

    expect(run).toHaveBeenCalledTimes(2); // initial + one retry, then give up
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).message).toContain(
      "AI agent failed to produce valid output",
    );
  });

  it("retries and surfaces a 502 when the runner throws (transient failure)", async () => {
    run.mockRejectedValue(new Error("provider timeout"));

    const error = await runLessonAgent(INPUT).catch((e: unknown) => e);

    expect(run).toHaveBeenCalledTimes(2);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).message).toContain("provider timeout");
  });
});
