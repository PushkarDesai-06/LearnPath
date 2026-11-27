import { describe, expect, it } from "vitest";
import {
  advanceSequence,
  IDLE_SEQUENCE,
  SEQUENCE_WINDOW_MS,
} from "@/lib/client/keySequence";
import {
  pageOwnsLetters,
  shouldIgnoreShortcut,
  type ShortcutEventInfo,
} from "@/lib/client/shortcutRules";
import { filterShortcuts, SHORTCUTS, displayKey } from "@/components/shell/shortcuts";

describe("advanceSequence", () => {
  it("arms on G and consumes it", () => {
    const step = advanceSequence(IDLE_SEQUENCE, "g", 100);
    expect(step.consumed).toBe(true);
    expect(step.target).toBeNull();
    expect(step.state.pendingSince).toBe(100);
  });

  it.each([
    ["d", "dashboard"],
    ["R", "review"],
    ["t", "tutor"],
    ["a", "topics"],
    ["s", "account"],
  ])("resolves G then %s", (key, target) => {
    const armed = advanceSequence(IDLE_SEQUENCE, "g", 0).state;
    const step = advanceSequence(armed, key, 500);
    expect(step.target).toBe(target);
    expect(step.consumed).toBe(true);
    expect(step.state).toEqual(IDLE_SEQUENCE);
  });

  it("expires after the window", () => {
    const armed = advanceSequence(IDLE_SEQUENCE, "g", 0).state;
    const step = advanceSequence(armed, "d", SEQUENCE_WINDOW_MS + 1);
    expect(step.target).toBeNull();
    expect(step.consumed).toBe(false);
  });

  it("drops the sequence on an unrelated key without consuming it", () => {
    const armed = advanceSequence(IDLE_SEQUENCE, "g", 0).state;
    const step = advanceSequence(armed, "c", 100);
    expect(step.consumed).toBe(false);
    expect(step.state).toEqual(IDLE_SEQUENCE);
  });

  it("a second G restarts the window", () => {
    const armed = advanceSequence(IDLE_SEQUENCE, "g", 0).state;
    const step = advanceSequence(armed, "g", 900);
    expect(step.state.pendingSince).toBe(900);
  });

  it("ignores destination keys when nothing is armed", () => {
    expect(advanceSequence(IDLE_SEQUENCE, "d", 0).consumed).toBe(false);
  });
});

const base: ShortcutEventInfo = {
  kind: "letter",
  isComposing: false,
  defaultPrevented: false,
  repeat: false,
  typing: false,
  overlayOpen: false,
  pageOwnsLetters: false,
};

describe("shouldIgnoreShortcut", () => {
  it("allows a plain letter on a free page", () => {
    expect(shouldIgnoreShortcut(base)).toBe(false);
  });

  it("ignores typing, composition, repeats, overlays and handled events", () => {
    expect(shouldIgnoreShortcut({ ...base, typing: true })).toBe(true);
    expect(shouldIgnoreShortcut({ ...base, isComposing: true })).toBe(true);
    expect(shouldIgnoreShortcut({ ...base, repeat: true })).toBe(true);
    expect(shouldIgnoreShortcut({ ...base, overlayOpen: true })).toBe(true);
    expect(shouldIgnoreShortcut({ ...base, defaultPrevented: true })).toBe(true);
  });

  it("lets chords through while typing but not during composition or an overlay", () => {
    expect(shouldIgnoreShortcut({ ...base, kind: "chord", typing: true })).toBe(false);
    expect(shouldIgnoreShortcut({ ...base, kind: "chord", isComposing: true })).toBe(true);
    expect(shouldIgnoreShortcut({ ...base, kind: "chord", overlayOpen: true })).toBe(true);
  });

  it("only blocks letters, not symbols, where the page owns them", () => {
    expect(shouldIgnoreShortcut({ ...base, pageOwnsLetters: true })).toBe(true);
    expect(
      shouldIgnoreShortcut({ ...base, kind: "symbol", pageOwnsLetters: true }),
    ).toBe(false);
  });

  it("treats the flashcards route as owning letters", () => {
    expect(pageOwnsLetters("/flashcards")).toBe(true);
    expect(pageOwnsLetters("/dashboard")).toBe(false);
  });
});

describe("shortcut sheet helpers", () => {
  it("filters by label, group and keys", () => {
    expect(filterShortcuts(SHORTCUTS, "theme")[0].items[0].label).toBe("Cycle theme");
    expect(filterShortcuts(SHORTCUTS, "go to")[0].group).toBe("Go to");
    expect(filterShortcuts(SHORTCUTS, "zzzz")).toEqual([]);
    expect(filterShortcuts(SHORTCUTS, "  ")).toBe(SHORTCUTS);
  });

  it("shows Cmd and Shift glyphs on macOS only", () => {
    expect(displayKey("Ctrl", true)).toBe("⌘");
    expect(displayKey("Ctrl", false)).toBe("Ctrl");
    expect(displayKey("K", true)).toBe("K");
  });
});
