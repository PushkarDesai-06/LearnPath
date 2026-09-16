import { describe, it, expect } from "vitest";
import { publicLessonBlock } from "@/lib/server/curriculumLocate";
import type { LessonBlock } from "@/lib/db/models";

const mcq: LessonBlock = {
  kind: "practice",
  questionId: "q1",
  prompt: "Which keyword defines a function in Python?",
  type: "mcq",
  choices: ["func", "def", "lambda"],
  correctKey: "1",
  explanation: "`def` introduces a named function.",
};

const short: LessonBlock = {
  kind: "practice",
  questionId: "q2",
  prompt: "Explain what a list comprehension does.",
  type: "short",
  rubric: "Mentions building a new list from an iterable in one expression.",
  explanation: "It builds a list from an iterable inline.",
};

describe("publicLessonBlock", () => {
  it("ships the key and explanation for an MCQ so the page can grade locally", () => {
    const out = publicLessonBlock(mcq) as Record<string, unknown>;
    expect(out.correctKey).toBe("1");
    expect(out.explanation).toBe("`def` introduces a named function.");
    expect(out.choices).toEqual(["func", "def", "lambda"]);
  });

  it("never ships a rubric, even on an MCQ that somehow has one", () => {
    const out = publicLessonBlock({ ...mcq, rubric: "secret" });
    expect(out).not.toHaveProperty("rubric");
  });

  it("hides the answer for a short-answer question", () => {
    const out = publicLessonBlock(short);
    expect(out).not.toHaveProperty("rubric");
    expect(out).not.toHaveProperty("correctKey");
    expect(out).not.toHaveProperty("explanation");
  });

  it("normalizes a missing MCQ key/explanation to null rather than dropping them", () => {
    const out = publicLessonBlock({
      kind: "practice",
      questionId: "q3",
      prompt: "?",
      type: "mcq",
      choices: ["a", "b"],
    }) as Record<string, unknown>;
    expect(out.correctKey).toBeNull();
    expect(out.explanation).toBeNull();
  });

  it("passes non-practice blocks through untouched", () => {
    const text: LessonBlock = { kind: "text", markdown: "Hello" };
    expect(publicLessonBlock(text)).toEqual(text);
  });
});
