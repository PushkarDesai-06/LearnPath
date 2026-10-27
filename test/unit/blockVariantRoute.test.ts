/**
 * The variants route: same ownership and module-access rules as the lesson, a
 * stored rewrite is returned without calling the model, concurrent requests
 * don't run the agent twice, failures are recorded, and the daily limit holds.
 */
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlockVariantDoc, CurriculumDoc, LessonDoc } from "@/lib/db/models";
import { curriculumFixture, lessonFixture } from "../helpers/curriculum";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), locate: vi.fn(), learner: vi.fn(), agent: vi.fn(),
  lessonFind: vi.fn(),
  variantFind: vi.fn(), variantCreate: vi.fn(), variantUpdate: vi.fn(), variantCount: vi.fn(),
  variantDelete: vi.fn(),
  eventCreate: vi.fn(),
}));
vi.mock("@/lib/auth/guards", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/server/curriculumLocate", () => ({ locateLesson: mocks.locate }));
vi.mock("@/lib/jobs/learnerContext", () => ({ loadLearnerContext: mocks.learner }));
vi.mock("@/lib/ai/agents/variant", () => ({ runVariantAgent: mocks.agent }));
vi.mock("@/lib/ai/agents/artifact", () => ({ runArtifactAgent: vi.fn() }));
vi.mock("@/lib/ai/agents/lesson", () => ({ runLessonAgent: vi.fn() }));
vi.mock("@/lib/ai/provider", () => ({ modelName: () => "test-model" }));
vi.mock("@/lib/db/collections", () => ({
  lessonsCollection: async () => ({ findOne: mocks.lessonFind }),
  blockVariantsCollection: async () => ({
    findOne: mocks.variantFind, create: mocks.variantCreate,
    updateOne: mocks.variantUpdate, countDocuments: mocks.variantCount,
    deleteOne: mocks.variantDelete,
  }),
  progressEventsCollection: async () => ({ create: mocks.eventCreate }),
}));
import { POST } from "@/app/api/lesson/[lessonId]/blocks/[blockKey]/variants/route";
import { VARIANT_DAILY_LIMIT } from "@/lib/domain/variants";

let curriculum: CurriculumDoc;
let lesson: LessonDoc;
const params = (blockKey = "b-text", lessonId = "lesson-1") => ({
  params: Promise.resolve({ lessonId, blockKey }),
});
const post = (style: unknown = "simpler", blockKey?: string) =>
  POST(
    new Request("http://localhost/api/lesson/lesson-1/blocks/x/variants", {
      method: "POST",
      body: JSON.stringify({ style }),
    }),
    params(blockKey),
  );
const variant = (fields: Partial<BlockVariantDoc>) => ({
  _id: new ObjectId(), status: "ready", attempts: 1, claimToken: null, ...fields,
});

beforeEach(() => {
  vi.resetAllMocks();
  curriculum = curriculumFixture();
  lesson = {
    _id: new ObjectId(), userId: curriculum.userId, curriculumId: curriculum._id,
    lessonRef: "lesson-1", title: "Lesson", generatedAt: new Date(), model: "m", genStatus: "ready",
    blocks: [
      { kind: "text", blockId: "b-text", markdown: "Recursion is a function calling itself." },
      { kind: "code", blockId: "b-code", language: "js", code: "f(n - 1)" },
      { kind: "practice", questionId: "q1", type: "mcq", prompt: "What is the base case?", choices: ["a", "b"], correctKey: "0" },
    ],
  };
  mocks.user.mockResolvedValue({ _id: curriculum.userId });
  mocks.locate.mockResolvedValue({ curriculum, module: curriculum.modules[0], lesson: curriculum.modules[0].lessons[0] });
  mocks.learner.mockResolvedValue({ learnerLevel: "beginner", topicMastery: [] });
  mocks.lessonFind.mockImplementation(() => ({ lean: async () => lesson }));
  mocks.variantFind.mockImplementation(() => ({ lean: async () => null }));
  mocks.variantCount.mockResolvedValue(0);
  mocks.variantCreate.mockResolvedValue({});
  mocks.variantUpdate.mockResolvedValue({ matchedCount: 1 });
  mocks.agent.mockResolvedValue("Simpler words.");
});

describe("POST /api/lesson/[id]/blocks/[key]/variants", () => {
  it("writes a new rewrite with the lesson context and logs one event", async () => {
    const res = await post("simpler");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ready", style: "simpler", markdown: "Simpler words." });

    expect(mocks.agent.mock.calls[0][0]).toMatchObject({
      style: "simpler",
      block: { kind: "text", blockId: "b-text" },
      upcomingPractice: ["What is the base case?"],
    });
    const created = mocks.variantCreate.mock.calls[0][0];
    expect(created).toMatchObject({
      userId: curriculum.userId, curriculumId: curriculum._id, lessonRef: "lesson-1",
      blockKey: "b-text", style: "simpler", status: "generating", attempts: 1,
    });
    const [filter, update] = mocks.variantUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: created._id, claimToken: created.claimToken });
    expect(update.$set).toMatchObject({ status: "ready", markdown: "Simpler words.", claimToken: null });
    expect(mocks.eventCreate).toHaveBeenCalledTimes(1);
    expect(mocks.eventCreate.mock.calls[0][0]).toMatchObject({ type: "block_variant_requested" });
  });

  it("returns a stored rewrite without calling the model or the quota", async () => {
    mocks.variantFind.mockImplementation(() => ({ lean: async () => variant({ markdown: "Saved." }) }));
    const res = await post("simpler");
    expect(await res.json()).toEqual({ status: "ready", style: "simpler", markdown: "Saved." });
    expect(mocks.agent).not.toHaveBeenCalled();
    expect(mocks.variantCount).not.toHaveBeenCalled();
  });

  it("reports generating while another request holds a live claim", async () => {
    mocks.variantFind.mockImplementation(() => ({
      lean: async () => variant({ status: "generating", claimToken: "t", claimedAt: new Date() }),
    }));
    expect(await (await post()).json()).toEqual({ status: "generating", style: "simpler" });
    expect(mocks.agent).not.toHaveBeenCalled();
  });

  it("reports generating when a concurrent request wins the insert", async () => {
    mocks.variantCreate.mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));
    expect(await (await post()).json()).toEqual({ status: "generating", style: "simpler" });
    expect(mocks.agent).not.toHaveBeenCalled();
  });

  it("retries a failed rewrite by taking over its record", async () => {
    const failed = variant({ status: "failed", attempts: 1 });
    mocks.variantFind.mockImplementation(() => ({ lean: async () => failed }));
    const res = await post();
    expect(res.status).toBe(200);
    const [filter, update] = mocks.variantUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: failed._id, status: "failed", claimToken: null });
    expect(update.$inc).toEqual({ attempts: 1 });
    expect(mocks.variantCreate).not.toHaveBeenCalled();
  });

  it("stops after the attempt limit", async () => {
    mocks.variantFind.mockImplementation(() => ({ lean: async () => variant({ status: "failed", attempts: 3 }) }));
    expect((await post()).status).toBe(409);
    expect(mocks.agent).not.toHaveBeenCalled();
  });

  it("records a failure under its own claim and surfaces the error", async () => {
    mocks.agent.mockRejectedValue(new Error("model down"));
    const res = await post();
    expect(res.status).toBe(500);
    const [filter, update] = mocks.variantUpdate.mock.calls[0];
    expect(filter.claimToken).toBe(mocks.variantCreate.mock.calls[0][0].claimToken);
    expect(update.$set).toMatchObject({ status: "failed", error: "model down", claimToken: null });
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("reserves first, then refuses and rolls back a rewrite past the daily limit", async () => {
    mocks.variantCount.mockResolvedValue(VARIANT_DAILY_LIMIT + 1);
    expect((await post()).status).toBe(429);
    const created = mocks.variantCreate.mock.calls[0][0];
    // Only reservations up to this one count, so later parallel ones can't block it.
    expect(mocks.variantCount.mock.calls[0][0]).toMatchObject({
      userId: curriculum.userId, _id: { $lte: created._id },
    });
    expect(mocks.variantDelete).toHaveBeenCalledWith({ _id: created._id, claimToken: created.claimToken });
    expect(mocks.agent).not.toHaveBeenCalled();
  });

  it("allows the rewrite that reaches the limit exactly", async () => {
    mocks.variantCount.mockResolvedValue(VARIANT_DAILY_LIMIT);
    expect((await post()).status).toBe(200);
    expect(mocks.variantDelete).not.toHaveBeenCalled();
  });

  it("addresses blocks of older lessons by position", async () => {
    delete lesson.blocks[0].blockId;
    expect((await post("simpler", "i0")).status).toBe(200);
    expect(mocks.variantCreate.mock.calls[0][0].blockKey).toBe("i0");
  });

  it("rejects styles the block kind doesn't offer, and practice blocks", async () => {
    expect((await post("analogy", "b-code")).status).toBe(400);
    expect((await post("simpler", "i2")).status).toBe(400);
    expect((await post("louder")).status).toBe(400);
    expect(mocks.agent).not.toHaveBeenCalled();
  });

  it("404s another learner's lesson and unknown blocks, 403s a locked module", async () => {
    mocks.locate.mockResolvedValueOnce(null);
    expect((await post()).status).toBe(404);
    expect((await post("simpler", "missing")).status).toBe(404);
    // Only the next two incomplete modules are open, so the third is locked.
    curriculum.modules = Array.from({ length: 3 }, (_, i) => ({
      ...curriculum.modules[0], id: `m${i}`, order: i,
      lessons: [lessonFixture(i === 2 ? "lesson-1" : `l${i}`)],
    }));
    mocks.lessonFind.mockClear();
    expect((await post()).status).toBe(403);
    expect(mocks.lessonFind).not.toHaveBeenCalled();
  });

  it("409s a lesson that isn't written yet", async () => {
    lesson = { ...lesson, blocks: [], genStatus: "generating" };
    expect((await post()).status).toBe(409);
  });
});
