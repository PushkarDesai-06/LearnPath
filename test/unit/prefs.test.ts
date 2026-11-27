import { describe, expect, it } from "vitest";
import { MAX_PINS, MAX_RECENTS, addPin, addRecent, removeEntry, reorderPins } from "@/lib/domain/prefs";

const entry = (lessonId: string) => ({ lessonId });
const ids = (list: { lessonId: string }[]) => list.map((e) => e.lessonId);

describe("addPin", () => {
  it("appends to the end", () => {
    const result = addPin([entry("a")], entry("b"));
    expect(result.ok && ids(result.pins)).toEqual(["a", "b"]);
  });

  it("is idempotent for an already pinned lesson", () => {
    const pins = [entry("a"), entry("b")];
    const result = addPin(pins, entry("a"));
    expect(result).toEqual({ ok: true, pins });
  });

  it("refuses once the cap is reached, but still accepts a repeat", () => {
    const full = Array.from({ length: MAX_PINS }, (_, i) => entry(`l${i}`));
    expect(addPin(full, entry("new"))).toEqual({ ok: false, reason: "full" });
    expect(addPin(full, entry("l3")).ok).toBe(true);
  });

  it("does not mutate its input", () => {
    const pins = [entry("a")];
    addPin(pins, entry("b"));
    expect(ids(pins)).toEqual(["a"]);
  });
});

describe("removeEntry", () => {
  it("drops the lesson and ignores unknown ids", () => {
    expect(ids(removeEntry([entry("a"), entry("b")], "a"))).toEqual(["b"]);
    expect(ids(removeEntry([entry("a")], "zzz"))).toEqual(["a"]);
  });
});

describe("reorderPins", () => {
  const pins = [entry("a"), entry("b"), entry("c")];

  it("applies the requested order", () => {
    expect(ids(reorderPins(pins, ["c", "a", "b"]))).toEqual(["c", "a", "b"]);
  });

  it("ignores unknown and repeated ids", () => {
    expect(ids(reorderPins(pins, ["c", "x", "c", "b"]))).toEqual(["c", "b", "a"]);
  });

  it("keeps pins the order omits, in their original order, at the end", () => {
    expect(ids(reorderPins(pins, ["c"]))).toEqual(["c", "a", "b"]);
    expect(ids(reorderPins(pins, []))).toEqual(["a", "b", "c"]);
  });
});

describe("addRecent", () => {
  it("puts the newest first", () => {
    expect(ids(addRecent([entry("a")], entry("b")))).toEqual(["b", "a"]);
  });

  it("moves a repeat visit to the front without duplicating", () => {
    expect(ids(addRecent([entry("a"), entry("b"), entry("c")], entry("c")))).toEqual(["c", "a", "b"]);
  });

  it("caps the list, dropping the oldest", () => {
    let list: { lessonId: string }[] = [];
    for (let i = 0; i < MAX_RECENTS + 3; i++) list = addRecent(list, entry(`l${i}`));
    expect(list).toHaveLength(MAX_RECENTS);
    expect(list[0].lessonId).toBe(`l${MAX_RECENTS + 2}`);
    expect(ids(list)).not.toContain("l0");
  });
});
