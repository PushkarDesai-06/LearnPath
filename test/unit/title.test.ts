import { describe, it, expect } from "vitest";
import { tidyCurriculumTitle } from "@/lib/domain/title";

describe("tidyCurriculumTitle", () => {
  it.each([
    ["Personalized SQL Learning Path for Beginner", "SQL"],
    ["Personalized Learning Path: OpenAI Agents SDK with TypeScript & React", "OpenAI Agents SDK with TypeScript & React"],
    ["Rust OS Development Learning Path", "Rust OS Development"],
    ["Personalized JavaScript Testing Learning Path", "JavaScript Testing"],
    ["Personal Finance Tracker Android Learning Path", "Personal Finance Tracker Android"],
    ["Next.js Novice Learning Path: Server-Side Rendered Optimization", "Next.js Novice: Server-Side Rendered Optimization"],
    ["Data Structures for Intermediate Learners", "Data Structures"],
    ["Linear Algebra", "Linear Algebra"],
  ])("%s -> %s", (input, expected) => {
    expect(tidyCurriculumTitle(input)).toBe(expected);
  });

  it("never returns an empty title", () => {
    expect(tidyCurriculumTitle("Learning Path")).toBe("Learning Path");
  });
});
