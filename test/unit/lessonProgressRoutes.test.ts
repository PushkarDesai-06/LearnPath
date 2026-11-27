/**
 * Mark for review and reset: both run through the curriculum mutation and the
 * adaptation pass, respect module locks, and never touch generated content.
 */
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurriculumDoc } from "@/lib/db/models";
import { curriculumFixture, lessonFixture } from "../helpers/curriculum";

const mocks = vi.hoisted(() => ({ user: vi.fn(), locate: vi.fn(), eventCreate: vi.fn() }));
const store = vi.hoisted(() => ({ doc: null as unknown }));
vi.mock("@/lib/auth/guards", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/server/curriculumLocate", () => ({ locateLesson: mocks.locate }));
vi.mock("@/lib/db/collections", () => ({
  progressEventsCollection: async () => ({ create: mocks.eventCreate }),
}));
vi.mock("@/lib/server/curriculumMutation", () => ({
  mutateCurriculum: async (
    _userId: ObjectId,
    _curriculumId: ObjectId,
    mutate: (doc: CurriculumDoc) => { value: unknown; changed: boolean },
  ) => mutate(store.doc as CurriculumDoc).value,
}));
import { POST as review } from "@/app/api/lesson/[lessonId]/review/route";
import { POST as reset } from "@/app/api/lesson/[lessonId]/reset/route";

let doc: CurriculumDoc;
const call = (handler: typeof review, lessonId = "lesson-1") =>
  handler(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ lessonId }) });
const lessonOf = () => doc.modules[0].lessons[0];

beforeEach(() => {
  vi.resetAllMocks();
  doc = curriculumFixture();
  store.doc = doc;
  mocks.user.mockResolvedValue({ _id: doc.userId });
  mocks.locate.mockResolvedValue({ curriculum: doc });
  mocks.eventCreate.mockResolvedValue({});
});

describe("POST /api/lesson/[id]/review", () => {
  it("marks the lesson needs_review and logs an event", async () => {
    Object.assign(lessonOf(), { status: "in_progress", masteryScore: 0.6 });
    const res = await call(review);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ lessonRef: "lesson-1", status: "needs_review", masteryScore: 0.6 });
    expect(lessonOf().status).toBe("needs_review");
    expect(mocks.eventCreate.mock.calls[0][0]).toMatchObject({ type: "review_triggered", lessonRef: "lesson-1" });
  });

  it("holds a mastered lesson in review instead of letting adaptation re-master it", async () => {
    Object.assign(lessonOf(), { status: "mastered", masteryScore: 0.95 });
    const body = await (await call(review)).json();
    expect(body.status).toBe("needs_review");
    expect(body.masteryScore).toBeLessThan(0.8);
  });

  it("does not log again when it is already in review", async () => {
    Object.assign(lessonOf(), { status: "needs_review", masteryScore: 0.3 });
    expect((await call(review)).status).toBe(200);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("403s a lesson in a locked module and leaves it alone", async () => {
    doc.modules = [
      { ...doc.modules[0], id: "m0", order: 0, lessons: [{ ...lessonFixture("done"), status: "available" }] },
      { ...doc.modules[0], id: "m1", order: 1, lessons: [{ ...lessonFixture("later"), status: "available" }] },
      { ...doc.modules[0], id: "m2", order: 2, lessons: [lessonFixture("lesson-1")] },
    ];
    const res = await call(review);
    expect(res.status).toBe(403);
    expect(doc.modules[2].lessons[0].status).toBe("available");
  });

  it("404s a lesson that is not the learner's", async () => {
    mocks.locate.mockResolvedValue(null);
    expect((await call(review, "foreign")).status).toBe(404);
  });
});

describe("POST /api/lesson/[id]/reset", () => {
  it("clears mastery, attempts and completion and returns the lesson to available", async () => {
    Object.assign(lessonOf(), {
      status: "mastered",
      masteryScore: 0.9,
      practiceAttempts: [{ questionId: "q1", correct: true, score: 0.9, at: new Date() }],
      completion: { at: new Date(), timeSpentMs: 5 },
    });
    const res = await call(reset);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "available", masteryScore: 0 });
    expect(lessonOf()).not.toHaveProperty("completion");
    expect(lessonOf()).not.toHaveProperty("practiceAttempts");
    expect(lessonOf().contentGenerated).toBe(true);
  });

  it("404s an unknown lesson", async () => {
    mocks.locate.mockResolvedValue(null);
    expect((await call(reset, "foreign")).status).toBe(404);
  });

  it("401s without a session", async () => {
    const { unauthorized } = await import("@/lib/http");
    mocks.user.mockRejectedValue(unauthorized());
    expect((await call(reset)).status).toBe(401);
  });
});
