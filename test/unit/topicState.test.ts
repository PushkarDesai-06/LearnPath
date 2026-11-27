import { describe, expect, it } from "vitest";
import {
  applyTopicOverrides,
  moveBeside,
  normalizeTitle,
  sameOrder,
  shiftId,
  titleMatches,
  topicHasProgress,
  type TopicOverrides,
} from "@/lib/client/topicState";

describe("normalizeTitle", () => {
  it("trims and accepts 1 to 120 characters", () => {
    expect(normalizeTitle("  Rust  ")).toBe("Rust");
    expect(normalizeTitle("a".repeat(120))).toBe("a".repeat(120));
  });

  it("rejects empty and overlong titles", () => {
    expect(normalizeTitle("   ")).toBeNull();
    expect(normalizeTitle("a".repeat(121))).toBeNull();
  });
});

describe("topicHasProgress", () => {
  it("is false only with no mastery and no mastered lessons", () => {
    expect(topicHasProgress({ mastery: 0, lessonsMastered: 0 })).toBe(false);
    expect(topicHasProgress({ mastery: 0.1, lessonsMastered: 0 })).toBe(true);
    expect(topicHasProgress({ mastery: 0, lessonsMastered: 1 })).toBe(true);
  });
});

describe("titleMatches", () => {
  it("compares trimmed, case sensitive text", () => {
    expect(titleMatches(" Rust ", "Rust")).toBe(true);
    expect(titleMatches("rust", "Rust")).toBe(false);
  });
});

describe("applyTopicOverrides", () => {
  const active = [
    { id: "a", title: "Alpha" },
    { id: "b", title: "Beta" },
  ];
  const archived = [{ id: "c", title: "Gamma" }];
  const apply = (overrides: TopicOverrides) =>
    applyTopicOverrides(active, archived, overrides, (t) => ({ ...t }));

  it("returns the server lists with no overrides", () => {
    expect(apply(new Map())).toEqual({ active, archived });
  });

  it("shows renames in both lists", () => {
    const result = apply(
      new Map([
        ["a", { title: "Alef" }],
        ["c", { title: "Gimel" }],
      ]),
    );
    expect(result.active[0].title).toBe("Alef");
    expect(result.archived[0].title).toBe("Gimel");
  });

  it("moves an archived topic to the front of the archived list", () => {
    const result = apply(new Map([["a", { state: "archived" as const }]]));
    expect(result.active.map((t) => t.id)).toEqual(["b"]);
    expect(result.archived.map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("drops restored and deleted topics from the archived list", () => {
    expect(
      apply(new Map([["c", { state: "active" as const }]])).archived,
    ).toEqual([]);
    expect(
      apply(new Map([["c", { state: "deleted" as const }]])).archived,
    ).toEqual([]);
  });

  it("drops deleted topics from the active list", () => {
    const result = apply(new Map([["b", { state: "deleted" as const }]]));
    expect(result.active.map((t) => t.id)).toEqual(["a"]);
    expect(result.archived.map((t) => t.id)).toEqual(["c"]);
  });
});

describe("moveBeside", () => {
  const ids = ["a", "b", "c", "d"];

  it("moves before and after a target", () => {
    expect(moveBeside(ids, "d", "b", "before")).toEqual(["a", "d", "b", "c"]);
    expect(moveBeside(ids, "a", "c", "after")).toEqual(["b", "c", "a", "d"]);
  });

  it("leaves the order alone for itself or unknown ids", () => {
    expect(moveBeside(ids, "b", "b", "after")).toBe(ids);
    expect(moveBeside(ids, "x", "b", "after")).toBe(ids);
    expect(moveBeside(ids, "b", "x", "after")).toBe(ids);
  });

  it("dropping next to the original neighbour keeps the order", () => {
    expect(sameOrder(moveBeside(ids, "b", "a", "after"), ids)).toBe(true);
  });
});

describe("shiftId", () => {
  const ids = ["a", "b", "c"];

  it("swaps with the neighbour", () => {
    expect(shiftId(ids, "b", -1)).toEqual(["b", "a", "c"]);
    expect(shiftId(ids, "b", 1)).toEqual(["a", "c", "b"]);
  });

  it("stops at the ends", () => {
    expect(shiftId(ids, "a", -1)).toBe(ids);
    expect(shiftId(ids, "c", 1)).toBe(ids);
    expect(shiftId(ids, "x", 1)).toBe(ids);
  });
});
