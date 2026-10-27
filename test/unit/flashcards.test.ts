/**
 * Flashcard rules: the review schedule, the interval labels on the grade
 * buttons, when an existing deck record may be taken over, how the model's
 * cards are cleaned up, and the Anki export format.
 */
import { describe, expect, it } from "vitest";
import {
  cleanCards,
  deckClaimState,
  DECK_STALE_MS,
  formatInterval,
  MAX_CARDS_PER_DECK,
  MAX_DECK_ATTEMPTS,
  NEW_CARD,
  previewIntervals,
  RELEARN_MS,
  scheduleCard,
  toAnkiText,
} from "@/lib/domain/flashcards";
import { lessonText } from "@/lib/ai/agents/flashcards";
import type { FlashcardSchedule } from "@/lib/db/models";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 0, 1);
const days = (s: { due: Date }) => (s.due.getTime() - now) / DAY;

describe("scheduleCard", () => {
  it("schedules a new card a day out for hard and good, four for easy", () => {
    expect(days(scheduleCard(NEW_CARD, "hard", now))).toBe(1);
    expect(days(scheduleCard(NEW_CARD, "good", now))).toBe(1);
    expect(days(scheduleCard(NEW_CARD, "easy", now))).toBe(4);
    expect(scheduleCard(NEW_CARD, "good", now)).toMatchObject({ reps: 1, intervalDays: 1, ease: 2.5 });
  });

  it("grows the interval with each good review", () => {
    let card: FlashcardSchedule = NEW_CARD;
    const intervals: number[] = [];
    for (let i = 0; i < 5; i++) {
      const next = scheduleCard(card, "good", now);
      intervals.push(next.intervalDays);
      card = next;
    }
    expect(intervals).toEqual([1, 3, 8, 20, 50]);
  });

  it("keeps hard <= good < easy at every stage", () => {
    let card: FlashcardSchedule = NEW_CARD;
    for (let i = 0; i < 6; i++) {
      const hard = scheduleCard(card, "hard", now).intervalDays;
      const good = scheduleCard(card, "good", now).intervalDays;
      const easy = scheduleCard(card, "easy", now).intervalDays;
      expect(hard).toBeLessThanOrEqual(good);
      expect(good).toBeLessThan(easy);
      card = scheduleCard(card, "good", now);
    }
  });

  it("brings a forgotten card back within minutes, counts the lapse and lowers ease", () => {
    const learned = { reps: 3, intervalDays: 8, ease: 2.5, lapses: 0 };
    const again = scheduleCard(learned, "again", now);
    expect(again.due.getTime() - now).toBe(RELEARN_MS);
    expect(again).toMatchObject({ reps: 0, intervalDays: 0, ease: 2.3, lapses: 1 });
    // Failing a card that was never learned isn't a lapse.
    expect(scheduleCard(NEW_CARD, "again", now).lapses).toBe(0);
  });

  it("never lets ease fall below 1.3 or the interval pass a year", () => {
    const worn = { reps: 5, intervalDays: 300, ease: 1.3, lapses: 4 };
    expect(scheduleCard(worn, "hard", now).ease).toBe(1.3);
    expect(scheduleCard(worn, "again", now).ease).toBe(1.3);
    expect(scheduleCard({ ...worn, ease: 3 }, "easy", now).intervalDays).toBe(365);
  });
});

describe("interval labels", () => {
  it("formats minutes, hours, days, months and years", () => {
    expect(formatInterval(10 * 60 * 1000)).toBe("10m");
    expect(formatInterval(3 * 60 * 60 * 1000)).toBe("3h");
    expect(formatInterval(3 * DAY)).toBe("3d");
    expect(formatInterval(60 * DAY)).toBe("2mo");
    expect(formatInterval(365 * DAY)).toBe("1y");
  });

  it("previews what each grade would do to a card", () => {
    expect(previewIntervals(NEW_CARD)).toEqual({ again: "10m", hard: "1d", good: "1d", easy: "4d" });
  });
});

describe("deckClaimState", () => {
  it("serves ready decks and waits on a live claim", () => {
    expect(deckClaimState({ status: "ready", attempts: 1 }, now)).toBe("ready");
    expect(deckClaimState({ status: "generating", attempts: 1, claimedAt: new Date(now - 1000) }, now)).toBe("busy");
  });

  it("takes over failed or abandoned decks until the attempts run out", () => {
    expect(deckClaimState({ status: "failed", attempts: 1 }, now)).toBe("retry");
    const stale = new Date(now - DECK_STALE_MS - 1);
    expect(deckClaimState({ status: "generating", attempts: 1, claimedAt: stale }, now)).toBe("retry");
    expect(deckClaimState({ status: "failed", attempts: MAX_DECK_ATTEMPTS }, now)).toBe("exhausted");
  });
});

describe("cleanCards", () => {
  it("trims, drops empty and duplicate fronts, and caps the deck", () => {
    expect(cleanCards([
      { front: " What is recursion? ", back: " A function calling itself. " },
      { front: "what is  RECURSION?", back: "dup" },
      { front: "", back: "no front" },
      { front: "Base case", back: " " },
    ])).toEqual([{ front: "What is recursion?", back: "A function calling itself." }]);
    const many = Array.from({ length: 20 }, (_, i) => ({ front: `Q${i}`, back: `A${i}` }));
    expect(cleanCards(many)).toHaveLength(MAX_CARDS_PER_DECK);
  });
});

describe("toAnkiText", () => {
  it("writes Anki headers and one escaped, tab-separated line per card", () => {
    const text = toAnkiText("Python::Basics\tfor data", [
      { front: "What does `len(x)` return?", back: "The number of items.\nWorks on <list> & str.", lessonTitle: "Built-in functions!" },
    ]);
    expect(text.split("\n")).toEqual([
      "#separator:tab",
      "#html:true",
      "#deck:LearnPath::Python:Basics for data",
      "#tags column:3",
      "What does <code>len(x)</code> return?\tThe number of items.<br>Works on &lt;list&gt; &amp; str.\tLearnPath Built-in_functions",
      "",
    ]);
  });

  it("keeps tabs inside a card from splitting its columns", () => {
    const line = toAnkiText("T", [{ front: "a\tb", back: "c", lessonTitle: "L" }]).split("\n")[4];
    expect(line.split("\t")).toHaveLength(3);
  });
});

describe("lessonText", () => {
  it("sends prose and code to the agent, but not practice or demos", () => {
    const text = lessonText([
      { kind: "text", markdown: "Intro" },
      { kind: "code", language: "py", code: "print(1)", caption: "Hello" },
      { kind: "practice", prompt: "Secret question", type: "short", rubric: "r" },
      { kind: "interactive", spec: "Demo spec" },
      { kind: "analogy", markdown: "Like a mirror" },
    ]);
    expect(text).toBe("Intro\n\nHello\n```py\nprint(1)\n```\n\nLike a mirror");
  });
});
