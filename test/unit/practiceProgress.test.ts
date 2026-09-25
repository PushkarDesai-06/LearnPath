import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurriculumDoc } from "@/lib/db/models";
import { copyCurriculum, curriculumFixture, lessonFixture } from "../helpers/curriculum";

const mocks = vi.hoisted(() => ({ findOne: vi.fn(), updateOne: vi.fn(), event: vi.fn(), exists: vi.fn() }));
vi.mock("@/lib/db/collections", () => ({
  curriculaCollection: async () => ({ findOne: mocks.findOne, collection: { updateOne: mocks.updateOne } }),
  progressEventsCollection: async () => ({ updateOne: mocks.event, exists: mocks.exists }),
}));
import { recordPractice } from "@/lib/server/practiceProgress";
import { completeLesson } from "@/lib/server/completeLesson";
import { mutateCurriculum } from "@/lib/server/curriculumMutation";

let stored: CurriculumDoc;
beforeEach(() => {
  vi.resetAllMocks();
  stored = curriculumFixture();
  mocks.findOne.mockImplementation(() => ({ lean: async () => copyCurriculum(stored) }));
  mocks.updateOne.mockImplementation(async (filter, update) => {
    if (filter.revision !== stored.revision) return { matchedCount: 0 };
    stored = { ...stored, ...update.$set, revision: (stored.revision ?? 0) + 1 };
    return { matchedCount: 1 };
  });
});

describe("concurrent curriculum mutations", () => {
  const complete = () => completeLesson({ userId: stored.userId, curriculumId: stored._id, lessonRef: "lesson-1", timeSpentMs: 1000 });

  it("preserves a practice answer that lands after completion reads the curriculum", async () => {
    const update = mocks.updateOne.getMockImplementation()!;
    mocks.updateOne.mockImplementationOnce(async (filter, change) => {
      await submit();
      return update(filter, change);
    });
    await complete();
    const lesson = stored.modules[0].lessons[0];
    expect(lesson.masteryScore).toBe(0.5);
    expect(lesson.practiceAttempts).toHaveLength(1);
    expect(lesson.completion).toBeDefined();
  });

  it("preserves worker content flags when a completion snapshot becomes stale", async () => {
    stored.modules[0].lessons[0].contentGenerated = false;
    const update = mocks.updateOne.getMockImplementation()!;
    mocks.updateOne.mockImplementationOnce(async (filter, change) => {
      await mutateCurriculum(stored.userId, stored._id, (doc) => {
        doc.modules[0].lessons[0].contentGenerated = true;
        return { changed: true, value: undefined };
      });
      return update(filter, change);
    });
    await complete();
    expect(stored.modules[0].lessons[0].contentGenerated).toBe(true);
  });

  it("counts completion credit and elapsed time once when requests overlap", async () => {
    await Promise.all([complete(), complete()]);
    expect(stored.modules[0].lessons[0].masteryScore).toBe(0.35);
    const completedEvents = mocks.event.mock.calls.filter((call) => call[1].$setOnInsert.type === "lesson_completed");
    expect(completedEvents[0][0]).toEqual(completedEvents[1][0]);
  });

  it("returns a retryable conflict instead of overwriting after repeated contention", async () => {
    mocks.updateOne.mockResolvedValue({ matchedCount: 0 });
    await expect(submit()).rejects.toMatchObject({ status: 409 });
    expect(stored.modules[0].lessons[0].masteryScore).toBe(0);
    expect(mocks.event).not.toHaveBeenCalled();
  });

  it("compares legacy documents using an absent revision", async () => {
    delete stored.revision;
    mocks.updateOne.mockImplementation(async (filter, update) => {
      expect(filter.revision).toEqual({ $exists: false });
      stored = { ...stored, ...update.$set, revision: 1 };
      return { matchedCount: 1 };
    });
    await submit();
    expect(stored.revision).toBe(1);
  });

  it("rechecks access when another answer moves the module window before saving", async () => {
    stored.modules = Array.from({ length: 3 }, (_, i) => ({
      ...stored.modules[0], id: `m${i}`, order: i, lessons: [lessonFixture(`l${i}`)],
    }));
    stored.modules[0].lessons[0].status = "mastered";
    stored.modules[0].lessons[0].masteryScore = 1;
    mocks.updateOne.mockImplementationOnce(async () => {
      stored.modules[0].lessons[0].status = "needs_review";
      stored.modules[0].lessons[0].masteryScore = 0.2;
      stored.revision = 1;
      return { matchedCount: 0 };
    });
    await expect(recordPractice({ userId: stored.userId, curriculumId: stored._id,
      lessonId: "l2", questionId: "q1", correct: true, outcome: 1,
      countsTowardMastery: true })).rejects.toMatchObject({ status: 403 });
    expect(stored.modules[2].lessons[0].masteryScore).toBe(0);
    expect(mocks.event).not.toHaveBeenCalled();
  });
});

function submit(questionId = "q1", countsTowardMastery = true) {
  return recordPractice({ userId: stored.userId, curriculumId: stored._id,
    lessonId: "lesson-1", questionId, correct: true, outcome: 1, countsTowardMastery });
}

describe("server-owned practice attempts", () => {
  it("counts a question once across reloads and repeated POSTs", async () => {
    expect((await submit()).counted).toBe(true);
    expect((await submit()).counted).toBe(false);
    expect(stored.modules[0].lessons[0].masteryScore).toBe(0.5);
    expect(stored.modules[0].lessons[0].practiceAttempts).toHaveLength(1);
    expect(mocks.event.mock.calls[0][0]).toEqual(mocks.event.mock.calls[1][0]);
  });

  it("counts only once when identical requests overlap", async () => {
    const results = await Promise.all([submit(), submit()]);
    expect(results.filter((r) => r.counted)).toHaveLength(1);
    expect(stored.modules[0].lessons[0].masteryScore).toBe(0.5);
  });

  it("recomputes from current mastery when different answers overlap", async () => {
    const results = await Promise.all([submit("q1"), submit("q2")]);
    expect(results.every((r) => r.counted)).toBe(true);
    expect(stored.modules[0].lessons[0].masteryScore).toBe(0.75);
    expect(stored.modules[0].lessons[0].practiceAttempts).toHaveLength(2);
  });

  it("repairs failed event logging without applying mastery again", async () => {
    mocks.event.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(submit()).rejects.toThrow("database unavailable");
    expect((await submit()).counted).toBe(false);
    expect(stored.modules[0].lessons[0].masteryScore).toBe(0.5);
    expect(mocks.event.mock.calls[0][0]).toEqual(mocks.event.mock.calls[1][0]);
  });

  it("does not record practice-only attempts", async () => {
    expect((await submit("q1", false)).counted).toBe(false);
    expect(stored.modules[0].lessons[0].masteryScore).toBe(0);
    expect(mocks.updateOne).not.toHaveBeenCalled();
    expect(mocks.event).not.toHaveBeenCalled();
  });
});
