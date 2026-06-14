import { describe, it, expect } from "vitest";
import { ObjectId } from "mongodb";
import { buildCurriculumDoc } from "@/lib/server/curriculumBuild";
import { MASTERED_THRESHOLD } from "@/lib/domain/mastery";
import type { CurriculumOutput } from "@/lib/ai/schemas";
import type { AssessmentResult } from "@/lib/db/models";

const result: AssessmentResult = {
  estimatedLevel: "beginner",
  score: 0.5,
  perTopicMastery: [
    { topic: "arrays", score: 0.9 }, // already strong -> should seed mastered
    { topic: "loops", score: 0.3 },
  ],
  strengths: ["arrays"],
  gaps: ["loops"],
};

// Built loosely + cast so we can exercise coercion paths (invalid difficulty,
// zero estMinutes) that the typed schema would otherwise forbid.
function output(): CurriculumOutput {
  return {
    title: "Intro to X",
    modules: [
      {
        title: "Basics",
        summary: "foundations",
        prerequisites: [],
        lessons: [
          {
            title: "Arrays 101",
            objectives: ["o1"],
            estMinutes: 0, // -> coerced to a sane default
            difficultyLevel: "not-a-level", // -> coerced to "beginner"
            topics: ["arrays"],
          },
        ],
      },
      {
        title: "Advanced",
        summary: "next",
        prerequisites: ["  basics "], // case/space-insensitive title ref
        lessons: [
          {
            title: "Loops deep dive",
            objectives: ["o2"],
            estMinutes: 7.6,
            difficultyLevel: "intermediate",
            topics: ["loops"],
          },
          {
            title: "Brand new topic",
            objectives: ["o3"],
            estMinutes: 12,
            difficultyLevel: "advanced",
            topics: ["unseen"], // not in mastery -> seed 0
          },
        ],
      },
    ],
  } as unknown as CurriculumOutput;
}

function build() {
  return buildCurriculumDoc({
    userId: new ObjectId(),
    assessmentId: new ObjectId(),
    domain: "X",
    result,
    output: output(),
  });
}

describe("buildCurriculumDoc", () => {
  it("carries title/domain and assigns sequential module + lesson order", () => {
    const doc = build();
    expect(doc.title).toBe("Intro to X");
    expect(doc.domain).toBe("X");
    expect(doc.modules.map((m) => m.order)).toEqual([0, 1]);
    expect(doc.modules[1].lessons.map((l) => l.order)).toEqual([0, 1]);
  });

  it("maps prerequisite titles to the generated module ids (case/space-insensitive)", () => {
    const doc = build();
    const basics = doc.modules[0];
    const advanced = doc.modules[1];
    expect(advanced.prerequisites).toEqual([basics.id]);
    expect(basics.id).not.toBe(advanced.id);
  });

  it("drops prerequisite titles that don't match any module", () => {
    const out = output();
    out.modules[1].prerequisites = ["does not exist"];
    const doc = buildCurriculumDoc({
      userId: new ObjectId(),
      assessmentId: new ObjectId(),
      domain: "X",
      result,
      output: out,
    });
    expect(doc.modules[1].prerequisites).toEqual([]);
  });

  it("seeds lesson mastery from assessed topic scores and marks known ones mastered", () => {
    const doc = build();
    const arrays = doc.modules[0].lessons[0];
    expect(arrays.masteryScore).toBeCloseTo(0.9, 10);
    expect(arrays.status).toBe("mastered");
    expect(arrays.masteryScore).toBeGreaterThanOrEqual(MASTERED_THRESHOLD);

    const unseen = doc.modules[1].lessons[1];
    expect(unseen.masteryScore).toBe(0);
    expect(unseen.status).toBe("available");
  });

  it("coerces invalid difficulty to 'beginner' and keeps valid ones", () => {
    const doc = build();
    expect(doc.modules[0].lessons[0].difficultyLevel).toBe("beginner");
    expect(doc.modules[1].lessons[0].difficultyLevel).toBe("intermediate");
  });

  it("normalizes estMinutes to a positive rounded integer", () => {
    const doc = build();
    expect(doc.modules[0].lessons[0].estMinutes).toBe(10); // 0 -> default 10
    expect(doc.modules[1].lessons[0].estMinutes).toBe(8); // 7.6 -> 8
  });

  it("generates unique lesson ids", () => {
    const doc = build();
    const ids = doc.modules.flatMap((m) => m.lessons.map((l) => l.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
  });
});
