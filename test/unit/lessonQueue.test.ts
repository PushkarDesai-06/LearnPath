import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LessonDoc } from "@/lib/db/models";
import { curriculumFixture } from "../helpers/curriculum";

const mocks = vi.hoisted(() => ({
  locate: vi.fn(), findOne: vi.fn(), updateOne: vi.fn(), create: vi.fn(), variantRows: vi.fn(),
}));
vi.mock("@/lib/server/curriculumLocate", () => ({ locateLesson: mocks.locate, publicLessonBlock: (b: unknown) => b }));
vi.mock("@/lib/db/collections", () => ({
  lessonsCollection: async () => ({ findOne: mocks.findOne, updateOne: mocks.updateOne, create: mocks.create }),
  blockVariantsCollection: async () => ({
    find: () => ({ sort: () => ({ lean: mocks.variantRows }) }),
  }),
}));
import { ensureLessonQueued, readLessonView } from "@/lib/data/lesson";

const curriculum = curriculumFixture();
let doc: LessonDoc;
beforeEach(() => {
  vi.resetAllMocks();
  doc = { _id: new ObjectId(), userId: curriculum.userId, curriculumId: curriculum._id,
    lessonRef: "lesson-1", title: "Lesson", blocks: [], generatedAt: new Date(), model: "",
    genStatus: "failed", generationAttempts: 1, failedAt: new Date(Date.now() - 60_000) };
  mocks.locate.mockResolvedValue({ curriculum, module: curriculum.modules[0], lesson: curriculum.modules[0].lessons[0] });
  mocks.findOne.mockImplementation(() => ({ lean: async () => doc }));
  mocks.updateOne.mockImplementation(async (_filter, update) => {
    doc = { ...doc, ...update.$set };
    return { matchedCount: 1 };
  });
});

describe("failed lesson generation", () => {
  it("reports a stable failed state across page reads and repeated polling", async () => {
    expect((await readLessonView(doc.userId.toHexString(), doc.lessonRef))?.status).toBe("failed");
    for (let i = 0; i < 4; i++) {
      expect((await ensureLessonQueued(doc.userId, doc.lessonRef))?.status).toBe("failed");
    }
    expect(mocks.updateOne).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("queues an explicit retry once without resetting its attempt count", async () => {
    expect((await ensureLessonQueued(doc.userId, doc.lessonRef, true))?.status).toBe("generating");
    await ensureLessonQueued(doc.userId, doc.lessonRef, true);
    expect(mocks.updateOne).toHaveBeenCalledTimes(1);
    expect(doc.generationAttempts).toBe(1);
    expect(mocks.updateOne.mock.calls[0][0]).toMatchObject({ genStatus: "failed" });
  });

  it("enforces cooldown and the attempt limit on the server", async () => {
    doc.failedAt = new Date();
    await expect(ensureLessonQueued(doc.userId, doc.lessonRef, true)).rejects.toMatchObject({ status: 409 });
    doc.failedAt = new Date(Date.now() - 60_000);
    doc.generationAttempts = 3;
    expect(await ensureLessonQueued(doc.userId, doc.lessonRef)).toMatchObject({ status: "failed", canRetry: false });
    await expect(ensureLessonQueued(doc.userId, doc.lessonRef, true)).rejects.toMatchObject({ status: 409 });
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it("does not clear a live claim even if its placeholder contains invalid blocks", async () => {
    doc.genStatus = "generating";
    doc.blocks = [{ kind: "text" }];
    await ensureLessonQueued(doc.userId, doc.lessonRef);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it("counts the original failure when retrying a legacy lesson", async () => {
    delete doc.generationAttempts;
    await ensureLessonQueued(doc.userId, doc.lessonRef, true);
    expect(doc.generationAttempts).toBe(1);
  });
});

describe("block variants on a ready lesson", () => {
  beforeEach(() => {
    doc.genStatus = "ready";
    doc.blocks = [
      { kind: "text", markdown: "Legacy prose" },
      { kind: "code", blockId: "b-code", code: "x = 1" },
      { kind: "practice", questionId: "q1", type: "mcq", prompt: "?", choices: ["a", "b"], correctKey: "0" },
    ];
    mocks.variantRows.mockResolvedValue([
      { blockKey: "i0", style: "simpler", markdown: "Easier prose" },
      { blockKey: "b-code", style: "walkthrough", markdown: "Line by line" },
    ]);
  });

  it("gives eligible blocks a key and their written rewrites on the page read", async () => {
    const view = await readLessonView(doc.userId.toHexString(), doc.lessonRef);
    if (view?.status !== "ready") throw new Error("expected a ready lesson");
    const [text, code, practice] = view.lesson.blocks;
    expect(text).toMatchObject({ blockKey: "i0", variants: [{ style: "simpler", markdown: "Easier prose" }] });
    expect(code).toMatchObject({ blockKey: "b-code", variants: [{ style: "walkthrough", markdown: "Line by line" }] });
    expect(practice.blockKey).toBeUndefined();
    expect(practice.variants).toBeUndefined();
  });

  it("leaves rewrites off the poller's response", async () => {
    const view = await ensureLessonQueued(doc.userId, doc.lessonRef);
    if (view?.status !== "ready") throw new Error("expected a ready lesson");
    expect(view.lesson.blocks[0]).toMatchObject({ blockKey: "i0" });
    expect(view.lesson.blocks[0].variants).toBeUndefined();
    expect(mocks.variantRows).not.toHaveBeenCalled();
  });
});
