import { describe, it, expect } from "vitest";
import { shuffleMcq, shuffledIndices, shufflePracticeChoices } from "@/lib/domain/shuffle";
import { gradeMcq } from "@/lib/domain/grade";

/** Deterministic PRNG so the permutations are reproducible. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}

describe("shuffledIndices", () => {
  it("returns a permutation of 0..n-1", () => {
    const order = shuffledIndices(6, seeded(7));
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("shuffleMcq", () => {
  const question = { choices: ["right", "wrong a", "wrong b", "wrong c"], correctKey: "0" };

  it("keeps the key pointing at the same choice text", () => {
    for (let seed = 1; seed < 50; seed++) {
      const out = shuffleMcq(question, seeded(seed));
      expect(out.choices[Number(out.correctKey)]).toBe("right");
      expect([...out.choices].sort()).toEqual([...question.choices].sort());
      expect(gradeMcq(out.correctKey, out.correctKey, out.choices)).toBe(true);
    }
  });

  it("moves the answer off the first slot for most seeds", () => {
    const firsts = Array.from({ length: 200 }, (_, seed) => shuffleMcq(question, seeded(seed + 1)))
      .filter((q) => q.correctKey === "0").length;
    expect(firsts).toBeLessThan(100);
  });

  it("leaves an invalid key untouched", () => {
    const bad = { choices: ["a", "b"], correctKey: "5" };
    expect(shuffleMcq(bad, seeded(3))).toBe(bad);
    const text = { choices: ["a", "b"], correctKey: "a" };
    expect(shuffleMcq(text, seeded(3))).toBe(text);
  });

  it("keeps other fields", () => {
    const out = shuffleMcq({ ...question, prompt: "p" }, seeded(9));
    expect(out.prompt).toBe("p");
  });
});

describe("shufflePracticeChoices", () => {
  it("only touches MCQ practice blocks", () => {
    const text = { kind: "text" as const, markdown: "hi" };
    expect(shufflePracticeChoices(text)).toBe(text);
    const short = { kind: "practice" as const, type: "short" as const, prompt: "q" };
    expect(shufflePracticeChoices(short)).toBe(short);
    const mcq = { kind: "practice" as const, type: "mcq" as const, prompt: "q", choices: ["x", "y", "z"], correctKey: "1" };
    const out = shufflePracticeChoices(mcq);
    expect(out.choices![Number(out.correctKey)]).toBe("y");
  });
});
