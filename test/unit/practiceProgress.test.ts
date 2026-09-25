import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurriculumDoc } from "@/lib/db/models";
import { copyCurriculum, curriculumFixture } from "../helpers/curriculum";

const mocks = vi.hoisted(() => ({ findOne: vi.fn(), updateOne: vi.fn(), event: vi.fn() }));
vi.mock("@/lib/db/collections", () => ({
  curriculaCollection: async () => ({ findOne: mocks.findOne, collection: { updateOne: mocks.updateOne } }),
  progressEventsCollection: async () => ({ updateOne: mocks.event }),
}));
import { recordPractice } from "@/lib/server/practiceProgress";

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
