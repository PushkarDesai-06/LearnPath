import { describe, expect, it } from "vitest";
import {
  ACTIVITY_DAYS,
  buildActivity,
  dayKey,
  isValidTimeZone,
  type ActivityEvent,
} from "@/lib/domain/activity";

const at = (iso: string, kind: ActivityEvent["kind"] = "answer"): ActivityEvent => ({
  at: new Date(iso),
  kind,
});

describe("dayKey", () => {
  it("uses the learner's calendar day, not the UTC day", () => {
    const instant = new Date("2026-03-10T23:30:00Z");
    expect(dayKey(instant, "UTC")).toBe("2026-03-10");
    expect(dayKey(instant, "Asia/Kolkata")).toBe("2026-03-11");
    expect(dayKey(instant, "America/Los_Angeles")).toBe("2026-03-10");
  });

  it("rolls over exactly at local midnight", () => {
    expect(dayKey(new Date("2026-03-10T18:29:59Z"), "Asia/Kolkata")).toBe("2026-03-10");
    expect(dayKey(new Date("2026-03-10T18:30:00Z"), "Asia/Kolkata")).toBe("2026-03-11");
  });

  it("handles the 23 hour spring-forward day", () => {
    expect(dayKey(new Date("2026-03-08T07:59:59Z"), "America/New_York")).toBe("2026-03-08");
    expect(dayKey(new Date("2026-03-09T03:59:59Z"), "America/New_York")).toBe("2026-03-08");
    expect(dayKey(new Date("2026-03-09T04:00:00Z"), "America/New_York")).toBe("2026-03-09");
  });

  it("handles the 25 hour fall-back day", () => {
    expect(dayKey(new Date("2026-11-01T03:59:59Z"), "America/New_York")).toBe("2026-10-31");
    expect(dayKey(new Date("2026-11-01T04:00:00Z"), "America/New_York")).toBe("2026-11-01");
    expect(dayKey(new Date("2026-11-02T04:59:59Z"), "America/New_York")).toBe("2026-11-01");
    expect(dayKey(new Date("2026-11-02T05:00:00Z"), "America/New_York")).toBe("2026-11-02");
  });
});

describe("isValidTimeZone", () => {
  it("accepts real zones and rejects everything else", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("America/Argentina/Buenos_Aires")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    for (const bad of ["", "Mars/Olympus", "not a zone", "../etc/passwd", "<script>"]) {
      expect(isValidTimeZone(bad)).toBe(false);
    }
  });
});

describe("buildActivity", () => {
  const now = new Date("2026-03-10T12:00:00Z");

  it("returns exactly 84 consecutive days ending today", () => {
    const { days } = buildActivity([], "UTC", now);
    expect(days).toHaveLength(ACTIVITY_DAYS);
    expect(days[0].date).toBe("2025-12-17");
    expect(days.at(-1)!.date).toBe("2026-03-10");
    expect(days.every((d) => d.total === 0)).toBe(true);
  });

  it("keeps the 84 days consecutive across a DST change", () => {
    const { days } = buildActivity([], "America/New_York", new Date("2026-03-20T12:00:00Z"));
    const dates = days.map((d) => d.date);
    expect(new Set(dates).size).toBe(ACTIVITY_DAYS);
    expect(dates).toContain("2026-03-08");
    expect(dates).toContain("2026-03-09");
  });

  it("counts lessons and answers separately per day", () => {
    const { days } = buildActivity(
      [at("2026-03-10T01:00:00Z", "lesson"), at("2026-03-10T02:00:00Z"), at("2026-03-10T03:00:00Z")],
      "UTC",
      now,
    );
    expect(days.at(-1)).toEqual({ date: "2026-03-10", lessons: 1, answers: 2, total: 3 });
  });

  it("buckets by the learner's zone", () => {
    const events = [at("2026-03-10T20:00:00Z")];
    expect(buildActivity(events, "UTC", now).days.at(-1)!.total).toBe(1);
    const kolkata = buildActivity(events, "Asia/Kolkata", now).days;
    expect(kolkata.at(-1)!.date).toBe("2026-03-10");
    expect(kolkata.at(-1)!.total).toBe(0);
  });

  describe("streaks", () => {
    const run = (dates: string[], today = now) =>
      buildActivity(dates.map((d) => at(`${d}T10:00:00Z`)), "UTC", today);

    it("is zero with no activity", () => {
      expect(run([])).toMatchObject({ currentStreak: 0, bestStreak: 0 });
    });

    it("counts consecutive days ending today", () => {
      expect(run(["2026-03-08", "2026-03-09", "2026-03-10"])).toMatchObject({
        currentStreak: 3,
        bestStreak: 3,
      });
    });

    it("stays alive when only yesterday has activity", () => {
      expect(run(["2026-03-08", "2026-03-09"])).toMatchObject({ currentStreak: 2, bestStreak: 2 });
    });

    it("is broken when the last activity was before yesterday", () => {
      expect(run(["2026-03-07", "2026-03-08"])).toMatchObject({ currentStreak: 0, bestStreak: 2 });
    });

    it("tracks the best streak separately from the current one", () => {
      const result = run([
        "2026-02-01", "2026-02-02", "2026-02-03", "2026-02-04",
        "2026-03-09", "2026-03-10",
      ]);
      expect(result).toMatchObject({ currentStreak: 2, bestStreak: 4 });
    });

    it("counts several events on one day once", () => {
      const result = buildActivity(
        [at("2026-03-10T01:00:00Z"), at("2026-03-10T05:00:00Z"), at("2026-03-10T09:00:00Z")],
        "UTC",
        now,
      );
      expect(result).toMatchObject({ currentStreak: 1, bestStreak: 1 });
    });

    it("measures the best streak beyond the 84 day window", () => {
      const old = Array.from({ length: 10 }, (_, i) => `2025-06-${String(i + 1).padStart(2, "0")}`);
      expect(run(old)).toMatchObject({ currentStreak: 0, bestStreak: 10 });
    });

    it("does not break a streak over the spring-forward day", () => {
      const result = buildActivity(
        [
          at("2026-03-07T15:00:00Z"),
          at("2026-03-08T15:00:00Z"),
          at("2026-03-09T15:00:00Z"),
        ],
        "America/New_York",
        new Date("2026-03-09T20:00:00Z"),
      );
      expect(result).toMatchObject({ currentStreak: 3, bestStreak: 3 });
    });

    it("does not break a streak over the fall-back day", () => {
      const result = buildActivity(
        [
          at("2026-10-31T15:00:00Z"),
          at("2026-11-01T15:00:00Z"),
          at("2026-11-02T15:00:00Z"),
        ],
        "America/New_York",
        new Date("2026-11-02T20:00:00Z"),
      );
      expect(result).toMatchObject({ currentStreak: 3, bestStreak: 3 });
    });

    it("keeps a late night session on the learner's day so the streak holds", () => {
      // 23:30 in Los Angeles on the 9th is already the 10th in UTC.
      const result = buildActivity(
        [at("2026-03-09T10:00:00Z"), at("2026-03-10T07:30:00Z")],
        "America/Los_Angeles",
        new Date("2026-03-10T20:00:00Z"),
      );
      expect(result.days.at(-1)!.date).toBe("2026-03-10");
      expect(result).toMatchObject({ currentStreak: 2, bestStreak: 2 });
    });

    it("rolls over at the new year", () => {
      const result = buildActivity(
        [at("2025-12-31T10:00:00Z"), at("2026-01-01T10:00:00Z")],
        "UTC",
        new Date("2026-01-01T12:00:00Z"),
      );
      expect(result).toMatchObject({ currentStreak: 2, bestStreak: 2 });
    });
  });
});
