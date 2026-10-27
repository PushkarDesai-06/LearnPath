/**
 * The second-pass artifact job: a block's failure stays with that block, the
 * lesson is never touched, and a lost claim stops all writes.
 */
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LessonDoc } from "@/lib/db/models";
import { curriculumFixture } from "../helpers/curriculum";

const mocks = vi.hoisted(() => ({
  updateOne: vi.fn(), updateMany: vi.fn(), findOneAndUpdate: vi.fn(),
  locate: vi.fn(), learner: vi.fn(), agent: vi.fn(),
}));
vi.mock("@/lib/db/collections", () => ({
  lessonsCollection: async () => ({
    updateOne: mocks.updateOne, updateMany: mocks.updateMany, findOneAndUpdate: mocks.findOneAndUpdate,
  }),
}));
vi.mock("@/lib/server/curriculumLocate", () => ({ locateLesson: mocks.locate }));
vi.mock("@/lib/jobs/learnerContext", () => ({ loadLearnerContext: mocks.learner }));
vi.mock("@/lib/ai/agents/artifact", () => ({ runArtifactAgent: mocks.agent }));
vi.mock("@/lib/ai/agents/lesson", () => ({ runLessonAgent: vi.fn() }));
vi.mock("@/lib/ai/provider", () => ({ modelName: () => "test-model" }));
import { claimNextArtifact, generateArtifacts, precedingText } from "@/lib/jobs/artifactWorker";
import { assignBlockIds } from "@/lib/jobs/lessonWorker";


const curriculum = curriculumFixture();
let doc: LessonDoc;
beforeEach(() => {
  vi.resetAllMocks();
  doc = {
    _id: new ObjectId(), userId: curriculum.userId, curriculumId: curriculum._id,
    lessonRef: "lesson-1", title: "Lesson", generatedAt: new Date(), model: "m", genStatus: "ready",
    artifactsStatus: "pending", artifactClaimToken: "tok", artifactAttempts: 1,
    blocks: [
      { kind: "text", markdown: "Binary search halves the range." },
      { kind: "interactive", blockId: "b1", caption: "Demo", spec: "Concept: halving.", artifactStatus: "pending" },
    ],
  };
  mocks.locate.mockResolvedValue({ curriculum, module: curriculum.modules[0], lesson: curriculum.modules[0].lessons[0] });
  mocks.learner.mockResolvedValue({ learnerLevel: "beginner", topicMastery: [] });
  mocks.updateOne.mockResolvedValue({ matchedCount: 1 });
});

describe("generateArtifacts", () => {
  it("writes the HTML to the block under the claim, with the preceding text as context", async () => {
    mocks.agent.mockResolvedValue("<script>1</script>");
    await generateArtifacts(doc);
    expect(mocks.agent.mock.calls[0][0]).toMatchObject({
      spec: "Concept: halving.", title: "Demo", context: "Binary search halves the range.",
    });
    const [filter, update, opts] = mocks.updateOne.mock.calls[0];
    expect(filter).toEqual({ _id: doc._id, artifactClaimToken: "tok" });
    expect(update.$set).toEqual({ "blocks.$[b].artifactStatus": "ready", "blocks.$[b].artifactHtml": "<script>1</script>" });
    expect(opts).toEqual({ arrayFilters: [{ "b.blockId": "b1" }] });
    expect(mocks.updateOne.mock.calls[1][1].$set).toMatchObject({ artifactsStatus: "done", artifactClaimToken: null });
  });

  it("marks only the block failed when the agent fails, never the lesson", async () => {
    mocks.agent.mockRejectedValue(new Error("bad html"));
    await generateArtifacts(doc);
    expect(mocks.updateOne.mock.calls[0][1].$set).toEqual({
      "blocks.$[b].artifactStatus": "failed", "blocks.$[b].artifactError": "bad html",
    });
    for (const [, update] of mocks.updateOne.mock.calls) {
      expect(Object.keys(update.$set)).not.toContain("genStatus");
    }
    expect(mocks.updateOne.mock.calls[1][1].$set.artifactsStatus).toBe("done");
  });

  it("stops writing once the claim is lost", async () => {
    mocks.agent.mockResolvedValue("<script>1</script>");
    mocks.updateOne.mockResolvedValue({ matchedCount: 0 });
    await generateArtifacts(doc);
    expect(mocks.updateOne).toHaveBeenCalledTimes(1);
  });

  it("skips blocks that are already built", async () => {
    doc.blocks[1].artifactStatus = "ready";
    await generateArtifacts(doc);
    expect(mocks.agent).not.toHaveBeenCalled();
    expect(mocks.updateOne.mock.calls[0][1].$set.artifactsStatus).toBe("done");
  });
});

describe("claimNextArtifact", () => {
  it("gives up on lessons out of attempts, then claims a pending one", async () => {
    mocks.findOneAndUpdate.mockReturnValue({ lean: async () => doc });
    expect(await claimNextArtifact()).toBe(doc);
    const [giveUpFilter, giveUp, giveUpOpts] = mocks.updateMany.mock.calls[0];
    expect(giveUpFilter).toMatchObject({ artifactsStatus: "pending", artifactAttempts: { $gte: 3 } });
    expect(giveUp.$set).toMatchObject({ "blocks.$[b].artifactStatus": "failed", artifactsStatus: "done" });
    expect(giveUpOpts).toEqual({ arrayFilters: [{ "b.artifactStatus": "pending" }] });
    expect(mocks.findOneAndUpdate.mock.calls[0][1]).toMatchObject({ $inc: { artifactAttempts: 1 } });
  });
});

describe("helpers", () => {
  it("assignBlockIds keeps a single interactive block and ids every block", () => {
    const out = assignBlockIds([
      { kind: "interactive", spec: "a" },
      { kind: "practice", prompt: "?" },
      { kind: "interactive", spec: "b" },
      { kind: "text", markdown: "prose" },
    ]);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ kind: "interactive", spec: "a", artifactStatus: "pending" });
    expect(out[0].blockId).toBeTruthy();
    expect(out[1].questionId).toBeTruthy();
    expect(out[2].blockId).toBeTruthy(); // what block variants are keyed by
    expect(new Set([out[0].blockId, out[2].blockId]).size).toBe(2);
  });

  it("precedingText finds the nearest earlier prose block", () => {
    expect(precedingText(doc.blocks, 1)).toBe("Binary search halves the range.");
    expect(precedingText(doc.blocks, 0)).toBeUndefined();
  });
});
