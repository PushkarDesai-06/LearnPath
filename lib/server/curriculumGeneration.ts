import { randomUUID } from "node:crypto";
import type { ObjectId } from "mongodb";
import { assessmentsCollection, curriculaCollection, onboardingCollection } from "@/lib/db/collections";
import type { CurriculumDoc } from "@/lib/db/models";
import { runCurriculumAgent } from "@/lib/ai/agents/curriculum";
import { adaptCurriculum } from "@/lib/domain/adapt";
import { badRequest, conflict, notFound } from "@/lib/http";
import { buildCurriculumDoc } from "@/lib/server/curriculumBuild";

const CLAIM_TTL_MS = 5 * 60 * 1000;

export async function generateCurriculum(userId: ObjectId, assessmentId: ObjectId) {
  const assessments = await assessmentsCollection();
  const assessment = await assessments.findOne({ _id: assessmentId, userId }).lean();
  if (!assessment) throw notFound("Assessment not found");
  if (assessment.state !== "complete" || !assessment.result) {
    throw badRequest("Complete this assessment before generating its curriculum");
  }
  const curricula = await curriculaCollection();
  const existing = () => curricula.findOne({ userId, assessmentId }).lean();
  const finish = async (curriculum: CurriculumDoc, existed: boolean) => {
    const onboarding = await onboardingCollection();
    await onboarding.updateOne(
      { _id: assessment.onboardingId, userId },
      { $set: { status: "learning", updatedAt: new Date() } },
    );
    return { curriculum, existed };
  };
  const previous = await existing();
  if (previous) return finish(previous, true);

  const token = randomUUID();
  const claim = await assessments.findOneAndUpdate(
    { _id: assessmentId, userId, state: "complete", $or: [
      { curriculumClaimToken: null },
      { curriculumClaimedAt: { $lt: new Date(Date.now() - CLAIM_TTL_MS) } },
    ] },
    { $set: { curriculumClaimToken: token, curriculumClaimedAt: new Date() } },
    { returnDocument: "after" },
  ).lean();
  if (!claim) throw conflict("Your path is already being generated. Please try again shortly.");
  const owner = { _id: assessmentId, userId, curriculumClaimToken: token };
  // Keep a live request's claim fresh; a crashed process expires naturally.
  const heartbeat = setInterval(() => {
    void assessments.updateOne(owner, { $set: { curriculumClaimedAt: new Date() } })
      .catch((error: unknown) => console.error("Curriculum claim renewal failed:", error));
  }, 30_000);
  heartbeat.unref();
  try {
    // Another request may have finished between our first lookup and claim.
    const ready = await existing();
    if (ready) return await finish(ready, true);
    if (!claim.result) throw badRequest("Assessment result is missing");
    const output = await runCurriculumAgent({
      domain: claim.domain, refinedTopic: claim.refinedTopic, result: claim.result,
    });
    if (!(await assessments.exists(owner))) {
      throw conflict("Path generation was restarted. Please try again.");
    }
    const doc = buildCurriculumDoc({ userId, assessmentId, domain: claim.domain, result: claim.result, output });
    // The existing unique _id index enforces one new curriculum per assessment,
    // even across expired claims. Legacy random-ID curricula were checked above.
    doc._id = assessmentId;
    doc.modules = adaptCurriculum(doc).modules;
    try {
      await curricula.create(doc);
    } catch (error) {
      if ((error as { code?: number })?.code !== 11000) throw error;
      const winner = await existing();
      if (!winner) throw error;
      return await finish(winner, true);
    }
    return await finish(doc, false);
  } finally {
    clearInterval(heartbeat);
    await assessments.updateOne(owner, { $set: { curriculumClaimToken: null, curriculumClaimedAt: null } });
  }
}
