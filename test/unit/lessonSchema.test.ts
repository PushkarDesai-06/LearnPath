/**
 * Unit tests for the lesson-content schema — the contract every lessonAgent
 * reply must satisfy. These are deterministic and need no API key: they pin
 * down exactly what counts as "correct lesson JSON" by exercising the
 * `blockHasContent` refinement, NOT just the base zod field types.
 *
 * The cases that earn their place here are the ones schemas.ts calls out as
 * unenforceable by the SDK's strict json_schema (empty blocks, content under
 * the wrong field, an out-of-range `correctKey`). That refinement is the only
 * thing standing between those and a structurally-valid-but-useless lesson, so
 * the live integration test (test/integration/agents.test.ts) — which proves
 * the REAL agent's output conforms — leans on it being correct.
 */
import { describe, it, expect } from "vitest";
import { lessonBlockSchema, lessonContentSchema } from "@/lib/ai/schemas";

// Minimal valid block builders, one per `kind`. Overrides let a test mutate a
// single field to drive it invalid.
const textBlock = (o: Record<string, unknown> = {}) => ({
  kind: "text",
  markdown: "Functions let you name and reuse a block of logic.",
  ...o,
});
const analogyBlock = (o: Record<string, unknown> = {}) => ({
  kind: "analogy",
  markdown: "A function is like a recipe: inputs in, a dish out.",
  ...o,
});
const exampleBlock = (o: Record<string, unknown> = {}) => ({
  kind: "example",
  markdown: "def add(a, b): return a + b  # add(2, 3) -> 5",
  ...o,
});
const codeBlock = (o: Record<string, unknown> = {}) => ({
  kind: "code",
  language: "python",
  code: "def greet(name):\n    return f'Hi {name}'",
  caption: "A one-line greeter.",
  ...o,
});
const mcqBlock = (o: Record<string, unknown> = {}) => ({
  kind: "practice",
  type: "mcq",
  prompt: "What does `return` do?",
  choices: ["Prints a value", "Hands a value back to the caller", "Loops"],
  correctKey: "1",
  explanation: "`return` passes a value back to whoever called the function.",
  ...o,
});
const shortBlock = (o: Record<string, unknown> = {}) => ({
  kind: "practice",
  type: "short",
  prompt: "In your own words, what is a parameter?",
  rubric: "Must say a parameter is a named input a function receives.",
  explanation: "A parameter names the value a function expects.",
  ...o,
});

const ok = (block: unknown) => lessonBlockSchema.safeParse(block).success;

describe("lessonBlockSchema — per-block content refinement", () => {
  it("accepts a minimally-valid block of each kind", () => {
    expect(ok(textBlock())).toBe(true);
    expect(ok(analogyBlock())).toBe(true);
    expect(ok(exampleBlock())).toBe(true);
    expect(ok(codeBlock())).toBe(true);
    expect(ok(mcqBlock())).toBe(true);
    expect(ok(shortBlock())).toBe(true);
  });

  // The headline failure mode: a block that declares only its `kind`. Strict
  // json_schema makes every field "present" (as null), so this passes the SDK
  // and is exactly what the refinement exists to catch.
  it("rejects a block that carries only its kind (no content)", () => {
    expect(ok({ kind: "text" })).toBe(false);
    expect(ok({ kind: "code" })).toBe(false);
    expect(ok({ kind: "practice" })).toBe(false);
  });

  it("rejects prose blocks whose markdown is empty or whitespace", () => {
    expect(ok(textBlock({ markdown: "" }))).toBe(false);
    expect(ok(textBlock({ markdown: "   " }))).toBe(false);
    expect(ok(analogyBlock({ markdown: null }))).toBe(false);
    expect(ok(exampleBlock({ markdown: "\n\t" }))).toBe(false);
  });

  // zod strips unknown keys, so content that arrived under the wrong field name
  // vanishes and the block reads as empty — must be rejected, not silently kept.
  it("rejects a block whose content arrived under the wrong field", () => {
    expect(ok({ kind: "text", text: "Some prose under the wrong key" })).toBe(
      false,
    );
    expect(ok({ kind: "code", markdown: "code-as-markdown" })).toBe(false);
  });

  it("rejects a code block with no code", () => {
    expect(ok(codeBlock({ code: "" }))).toBe(false);
    expect(ok(codeBlock({ code: null }))).toBe(false);
  });

  describe("practice blocks", () => {
    it("rejects practice with a missing or unknown type", () => {
      expect(ok(mcqBlock({ type: null }))).toBe(false);
      expect(ok(mcqBlock({ type: "essay" }))).toBe(false);
    });

    it("rejects practice with an empty prompt", () => {
      expect(ok(mcqBlock({ prompt: "" }))).toBe(false);
      expect(ok(shortBlock({ prompt: "   " }))).toBe(false);
    });

    it("rejects an mcq with fewer than two choices", () => {
      expect(ok(mcqBlock({ choices: ["only one"], correctKey: "0" }))).toBe(
        false,
      );
      expect(ok(mcqBlock({ choices: [], correctKey: "0" }))).toBe(false);
      expect(ok(mcqBlock({ choices: null }))).toBe(false);
    });

    it("rejects an mcq whose correctKey does not index a real choice", () => {
      // 3 choices -> valid keys are "0".."2"; "5" points at nothing.
      expect(ok(mcqBlock({ correctKey: "5" }))).toBe(false);
      // non-numeric / empty keys are structurally a string but unusable.
      expect(ok(mcqBlock({ correctKey: "abc" }))).toBe(false);
      expect(ok(mcqBlock({ correctKey: "" }))).toBe(false);
      expect(ok(mcqBlock({ correctKey: null }))).toBe(false);
    });

    it("accepts an mcq with a correctKey at either boundary", () => {
      expect(ok(mcqBlock({ correctKey: "0" }))).toBe(true); // first choice
      expect(ok(mcqBlock({ correctKey: "2" }))).toBe(true); // last of three
    });

    it("rejects a short-answer practice with no rubric", () => {
      expect(ok(shortBlock({ rubric: "" }))).toBe(false);
      expect(ok(shortBlock({ rubric: null }))).toBe(false);
    });

    it("accepts a short-answer practice with a non-empty rubric", () => {
      expect(ok(shortBlock())).toBe(true);
    });
  });
});

describe("lessonContentSchema — whole-lesson wrapper", () => {
  it("rejects a lesson with fewer than three blocks", () => {
    expect(
      lessonContentSchema.safeParse({ blocks: [] }).success,
    ).toBe(false);
    expect(
      lessonContentSchema.safeParse({ blocks: [textBlock(), analogyBlock()] })
        .success,
    ).toBe(false);
  });

  it("accepts a lesson of exactly three valid blocks", () => {
    const parsed = lessonContentSchema.safeParse({
      blocks: [textBlock(), analogyBlock(), exampleBlock()],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.blocks).toHaveLength(3);
  });

  it("rejects the whole lesson when any single block is invalid", () => {
    const parsed = lessonContentSchema.safeParse({
      blocks: [textBlock(), analogyBlock(), mcqBlock({ correctKey: "9" })],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a realistic mixed lesson (prose, code, both practice types)", () => {
    const parsed = lessonContentSchema.safeParse({
      blocks: [
        textBlock(),
        analogyBlock(),
        codeBlock(),
        mcqBlock(),
        exampleBlock(),
        shortBlock(),
      ],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.blocks).toHaveLength(6);
  });
});
