import { describe, it, expect } from "vitest";
import { gradeMcq, outcomeFromGrade } from "@/lib/server/grade";

describe("gradeMcq", () => {
  const choices = ["London", "Paris", "Rome"];

  it("matches when the answer equals the index key", () => {
    expect(gradeMcq("1", "1", choices)).toBe(true);
    expect(gradeMcq("0", "1", choices)).toBe(false);
  });

  it("trims whitespace on both sides before comparing the key", () => {
    expect(gradeMcq("  1 ", "1", choices)).toBe(true);
    expect(gradeMcq("2", " 2 ", undefined)).toBe(true);
  });

  it("matches when the answer equals the correct choice text", () => {
    expect(gradeMcq("Paris", "1", choices)).toBe(true);
    expect(gradeMcq("London", "1", choices)).toBe(false);
  });

  it("returns false when there is no correct key", () => {
    expect(gradeMcq("Paris", undefined, choices)).toBe(false);
  });

  it("returns false for a non-numeric key with no text match", () => {
    expect(gradeMcq("Paris", "abc", choices)).toBe(false);
  });

  it("returns false when the key indexes outside the choices", () => {
    expect(gradeMcq("Paris", "9", choices)).toBe(false);
  });
});

describe("outcomeFromGrade", () => {
  it("uses confidence directly when correct", () => {
    expect(outcomeFromGrade(true, 0.8)).toBeCloseTo(0.8, 10);
  });

  it("inverts confidence when incorrect", () => {
    expect(outcomeFromGrade(false, 0.8)).toBeCloseTo(0.2, 10);
  });

  it("a confident-correct answer outranks a confident-wrong one", () => {
    expect(outcomeFromGrade(true, 0.9)).toBeGreaterThan(
      outcomeFromGrade(false, 0.9),
    );
  });
});
