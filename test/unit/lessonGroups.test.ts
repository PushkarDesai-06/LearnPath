import { describe, expect, it } from "vitest";
import { buildGroups } from "@/lib/client/lessonGroups";
import { formatRelativeDay, formatCalendarDay } from "@/lib/client/dates";
import type { DashboardModule } from "@/lib/data/types";
import type { DashboardPrefs } from "@/lib/db/models";

function lesson(id: string, status: string, masteryScore = 0) {
  return {
    id,
    title: id,
    status,
    difficultyLevel: "beginner",
    estMinutes: 10,
    masteryScore,
    generated: false,
    objectives: [],
    lastPracticedAt: null,
  };
}

const modules: DashboardModule[] = [
  {
    id: "m1",
    title: "One",
    summary: "first",
    status: "in_progress",
    lessonsTotal: 3,
    lessonsMastered: 1,
    mastery: 0.5,
    lessons: [lesson("a", "mastered", 1), lesson("b", "needs_review", 0.4), lesson("c", "available")],
  },
  {
    id: "m2",
    title: "Two",
    summary: "second",
    status: "locked",
    lessonsTotal: 1,
    lessonsMastered: 0,
    mastery: 0,
    lessons: [lesson("d", "available")],
  },
];

const prefs: DashboardPrefs = {
  groupBy: "module",
  hideMastered: false,
  hideLocked: false,
  showSummaries: false,
};

describe("buildGroups", () => {
  it("groups by module and treats lessons in a locked module as locked", () => {
    const groups = buildGroups(modules, prefs);
    expect(groups.map((g) => g.anchorId)).toEqual(["mod-m1", "mod-m2"]);
    expect(groups[0].mastered).toBe(1);
    expect(groups[1].lessons[0].locked).toBe(true);
    expect(groups[0].summary).toBeNull();
  });

  it("applies hide options and drops emptied groups", () => {
    const groups = buildGroups(modules, { ...prefs, hideMastered: true, hideLocked: true });
    expect(groups).toHaveLength(1);
    expect(groups[0].lessons.map((l) => l.id)).toEqual(["b", "c"]);
    expect(groups[0].mastered).toBe(1);
  });

  it("groups by status in a fixed order and honours overrides", () => {
    const groups = buildGroups(modules, { ...prefs, groupBy: "status" }, {
      c: { status: "in_progress", masteryScore: 0.2 },
    });
    expect(groups.map((g) => g.title)).toEqual([
      "Needs review",
      "In progress",
      "Mastered",
      "Locked",
    ]);
  });

  it("shows summaries when asked", () => {
    expect(buildGroups(modules, { ...prefs, showSummaries: true })[0].summary).toBe("first");
  });
});

describe("dates", () => {
  it("counts relative days in the learner's zone", () => {
    const now = new Date("2026-11-18T01:00:00Z");
    expect(formatRelativeDay("2026-11-17T23:00:00Z", "UTC", now)).toBe("Yesterday");
    expect(formatRelativeDay("2026-11-17T23:00:00Z", "Asia/Kolkata", now)).toBe("Today");
    expect(formatRelativeDay("2026-11-15T10:00:00Z", "UTC", now)).toBe("3 days ago");
  });

  it("formats a calendar day without shifting it", () => {
    expect(formatCalendarDay("2026-11-18")).toBe("Wed, Nov 18");
  });
});
