import { describe, it, expect } from "vitest";
import {
  OPEN_MODULE_WINDOW,
  orderModules,
  gateModuleStatuses,
  adaptCurriculum,
} from "@/lib/domain/adapt";
import { MASTERED_THRESHOLD } from "@/lib/domain/mastery";
import type {
  CurriculumDoc,
  CurriculumLesson,
  CurriculumModule,
  LessonStatus,
} from "@/lib/db/models";

function lesson(p: Partial<CurriculumLesson> = {}): CurriculumLesson {
  return {
    id: p.id ?? "l",
    title: p.title ?? "lesson",
    objectives: [],
    order: p.order ?? 0,
    estMinutes: 10,
    difficultyLevel: "beginner",
    topics: [],
    contentGenerated: false,
    status: p.status ?? "available",
    masteryScore: p.masteryScore ?? 0,
    ...p,
  };
}

function mod(p: Partial<CurriculumModule> = {}): CurriculumModule {
  return {
    id: p.id ?? "m",
    title: p.title ?? "module",
    summary: "",
    order: p.order ?? 0,
    prerequisites: p.prerequisites ?? [],
    status: p.status ?? "available",
    lessons: p.lessons ?? [],
    ...p,
  };
}

const masteredLessons = () => [lesson({ status: "mastered", masteryScore: 1 })];

describe("orderModules (prerequisite topological sort)", () => {
  it("places prerequisites before dependents regardless of declared order", () => {
    const modules = [
      mod({ id: "c", order: 2, prerequisites: ["b"] }),
      mod({ id: "a", order: 0, prerequisites: [] }),
      mod({ id: "b", order: 1, prerequisites: ["a"] }),
    ];
    const ordered = orderModules(modules).map((m) => m.id);
    expect(ordered).toEqual(["a", "b", "c"]);
  });

  it("keeps independent siblings in authored (order) sequence", () => {
    const modules = [
      mod({ id: "y", order: 1 }),
      mod({ id: "x", order: 0 }),
      mod({ id: "z", order: 2 }),
    ];
    expect(orderModules(modules).map((m) => m.id)).toEqual(["x", "y", "z"]);
  });

  it("does not hang or drop modules on a prerequisite cycle", () => {
    const modules = [
      mod({ id: "a", order: 0, prerequisites: ["b"] }),
      mod({ id: "b", order: 1, prerequisites: ["a"] }),
    ];
    const ordered = orderModules(modules);
    expect(ordered).toHaveLength(2);
    expect(new Set(ordered.map((m) => m.id))).toEqual(new Set(["a", "b"]));
  });
});

describe("gateModuleStatuses (sliding access window)", () => {
  it(`opens the next ${OPEN_MODULE_WINDOW} incomplete modules and locks the rest`, () => {
    const modules = [
      mod({ id: "m0", order: 0 }),
      mod({ id: "m1", order: 1 }),
      mod({ id: "m2", order: 2 }),
      mod({ id: "m3", order: 3 }),
    ];
    const gated = gateModuleStatuses(modules);
    const statuses = gated.map((m) => m.status);
    // first OPEN_MODULE_WINDOW open, rest locked
    expect(statuses.slice(0, OPEN_MODULE_WINDOW).every((s) => s !== "locked")).toBe(
      true,
    );
    expect(statuses.slice(OPEN_MODULE_WINDOW).every((s) => s === "locked")).toBe(
      true,
    );
  });

  it("marks a fully-mastered module completed and does not spend the window on it", () => {
    const modules = [
      mod({ id: "done", order: 0, lessons: masteredLessons() }),
      mod({ id: "m1", order: 1 }),
      mod({ id: "m2", order: 2 }),
      mod({ id: "m3", order: 3 }),
    ];
    const gated = gateModuleStatuses(modules);
    expect(gated[0].status).toBe("completed");
    // window still opens 2 incomplete modules after the completed one
    expect(gated[1].status).not.toBe("locked");
    expect(gated[2].status).not.toBe("locked");
    expect(gated[3].status).toBe("locked");
  });

  it("reports an open module with active lessons as in_progress", () => {
    const modules = [
      mod({
        id: "m0",
        order: 0,
        lessons: [lesson({ status: "in_progress" as LessonStatus })],
      }),
    ];
    expect(gateModuleStatuses(modules)[0].status).toBe("in_progress");
  });

  it("an empty-lesson module is not 'completed' (needs at least one lesson)", () => {
    const gated = gateModuleStatuses([mod({ id: "m0", order: 0, lessons: [] })]);
    expect(gated[0].status).not.toBe("completed");
  });
});

describe("adaptCurriculum", () => {
  const docOf = (modules: CurriculumModule[]) =>
    ({ modules }) as unknown as CurriculumDoc;

  it("re-affirms mastered status from masteryScore and reorders weakest-first", () => {
    const modules = [
      mod({
        id: "m0",
        order: 0,
        lessons: [
          lesson({ id: "strong", order: 0, masteryScore: 0.9 }), // -> mastered
          lesson({ id: "weak", order: 1, masteryScore: 0.1, status: "available" }),
          lesson({
            id: "review",
            order: 2,
            masteryScore: 0.2,
            status: "needs_review",
          }),
        ],
      }),
    ];
    const { modules: out } = adaptCurriculum(docOf(modules));
    const lessons = out[0].lessons;

    // mastered lesson rises to the top; its score crossed MASTERED_THRESHOLD
    expect(lessons[0].id).toBe("strong");
    expect(lessons[0].status).toBe("mastered");
    expect(lessons[0].masteryScore).toBeGreaterThanOrEqual(MASTERED_THRESHOLD);

    // among non-done, needs_review is hoisted ahead of plain available
    const nonDone = lessons.filter((l) => l.status !== "mastered");
    expect(nonDone[0].id).toBe("review");

    // order is renumbered to the new sequence
    expect(lessons.map((l) => l.order)).toEqual([0, 1, 2]);
  });

  it("is idempotent: a second pass reports no change", () => {
    const modules = [
      mod({
        id: "m0",
        order: 0,
        lessons: [
          lesson({ id: "a", order: 0, masteryScore: 0.9 }),
          lesson({ id: "b", order: 1, masteryScore: 0.3 }),
        ],
      }),
      mod({ id: "m1", order: 1, prerequisites: ["m0"], lessons: [lesson()] }),
    ];
    const first = adaptCurriculum(docOf(modules));
    const second = adaptCurriculum(docOf(first.modules));
    expect(second.changed).toBe(false);
  });
});
