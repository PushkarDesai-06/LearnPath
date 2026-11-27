import { describe, expect, it } from "vitest";
import {
  buildSuggestions,
  findLessonLink,
  flattenLessons,
  orderActions,
  orderGroups,
  paletteContext,
  pickContinueLesson,
} from "@/lib/client/paletteIndex";
import type { ShellTopic } from "@/lib/data/types";

function topic(
  id: string,
  lessons: [string, string][][],
  extra: Partial<ShellTopic> = {},
  moduleStatus = "available",
): ShellTopic {
  return {
    id,
    title: `Topic ${id}`,
    mastery: 0,
    dueCards: 0,
    modules: lessons.map((ls, i) => ({
      id: `${id}m${i}`,
      title: `Module ${i}`,
      status: moduleStatus,
      lessonsTotal: ls.length,
      lessonsMastered: 0,
      lessons: ls.map(([lid, status]) => ({
        id: lid,
        title: `Lesson ${lid}`,
        status,
        masteryScore: 0.4,
      })),
    })),
    ...extra,
  } as ShellTopic;
}

describe("pickContinueLesson", () => {
  it("prefers needs_review over in_progress over available", () => {
    const t = topic("a", [[["l1", "available"], ["l2", "in_progress"], ["l3", "needs_review"]]]);
    expect(pickContinueLesson(t)?.lessonId).toBe("l3");
    const u = topic("a", [[["l1", "available"], ["l2", "in_progress"]]]);
    expect(pickContinueLesson(u)?.lessonId).toBe("l2");
    const v = topic("a", [[["l1", "mastered"], ["l2", "available"]]]);
    expect(pickContinueLesson(v)?.lessonId).toBe("l2");
  });

  it("skips locked lessons and locked modules", () => {
    expect(pickContinueLesson(topic("a", [[["l1", "locked"]]]))).toBeNull();
    expect(
      pickContinueLesson(topic("a", [[["l1", "in_progress"]]], {}, "locked")),
    ).toBeNull();
    expect(pickContinueLesson(undefined)).toBeNull();
  });
});

describe("buildSuggestions", () => {
  const a = topic("a", [[["a1", "available"]]], { dueCards: 0 });
  const b = topic("b", [[["b1", "in_progress"]]], { dueCards: 4 });

  it("uses the active topic and falls back to a topic with due cards", () => {
    const s = buildSuggestions({ topics: [a, b], activeId: "a", recents: [] });
    expect(s.continueLesson?.lessonId).toBe("a1");
    expect(s.review).toEqual({ count: 4, topicId: "b" });
  });

  it("starts from the most recent topic when none is active", () => {
    const recents = [
      { curriculumId: "b", lessonId: "b1", title: "t", topicTitle: "Topic b", moduleTitle: "m", moduleStatus: "available", status: "in_progress", masteryScore: 0 },
    ];
    const s = buildSuggestions({ topics: [a, b], activeId: null, recents });
    expect(s.continueLesson?.lessonId).toBe("b1");
  });

  it("offers no review without due cards", () => {
    expect(buildSuggestions({ topics: [a], activeId: "a", recents: [] }).review).toBeNull();
  });
});

describe("flattenLessons and findLessonLink", () => {
  const a = topic("a", [[["a1", "available"]]]);
  const b = topic("b", [[["b1", "locked"]]]);

  it("puts the active topic first and flags locked lessons", () => {
    const flat = flattenLessons([a, b], "b");
    expect(flat.map((l) => l.lessonId)).toEqual(["b1", "a1"]);
    expect(flat[0].locked).toBe(true);
    expect(flat[1].locked).toBe(false);
  });

  it("builds a pinnable link for a lesson id", () => {
    expect(findLessonLink([a, b], "b1")?.curriculumId).toBe("b");
    expect(findLessonLink([a, b], "nope")).toBeNull();
  });
});

describe("contextual ordering", () => {
  it("detects the page context", () => {
    expect(paletteContext("/learn/abc")).toBe("lesson");
    expect(paletteContext("/dashboard")).toBe("dashboard");
    expect(paletteContext("/topics")).toBe("other");
  });

  it("ranks actions first on a lesson and lessons first on a dashboard", () => {
    expect(orderGroups("lesson", false)[0]).toBe("actions");
    expect(orderGroups("dashboard", false)[1]).toBe("lessons");
    expect(orderGroups("other", false)[0]).toBe("suggested");
    expect(orderGroups("other", true)[0]).toBe("lessons");
  });

  it("moves lesson actions ahead only on a lesson page", () => {
    const actions = [
      { id: "x", scope: "global" as const },
      { id: "f", scope: "lesson" as const },
    ];
    expect(orderActions(actions, "lesson").map((a) => a.id)).toEqual(["f", "x"]);
    expect(orderActions(actions, "other").map((a) => a.id)).toEqual(["x", "f"]);
  });
});
