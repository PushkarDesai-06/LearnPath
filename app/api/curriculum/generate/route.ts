/**
 * Generate the learner's curriculum from their completed assessment, then run
 * the adaptation pass so module/lesson statuses and ordering are consistent.
 */
import { requireUser } from "@/lib/auth/guards";
import {
  assessmentsCollection,
  curriculaCollection,
  onboardingCollection,
} from "@/lib/db/collections";
import { runCurriculumAgent } from "@/lib/ai/agents/curriculum";
import { buildCurriculumDoc } from "@/lib/server/curriculumBuild";
import { adaptCurriculum } from "@/lib/domain/adapt";
import { publicCurriculum } from "@/lib/server/curriculumView";
import { badRequest, handler, json } from "@/lib/http";

export const POST = handler(async () => {
  const user = await requireUser();

  const assessments = await assessmentsCollection();
  const assessment = await assessments
    .findOne({ userId: user._id, state: "complete" })
    .sort({ updatedAt: -1 })
    .lean();
  if (!assessment || !assessment.result) {
    throw badRequest("Complete an assessment before generating a curriculum");
  }

  const curricula = await curriculaCollection();
  // One curriculum per assessment — return the existing one if present.
  const existing = await curricula
    .findOne({
      userId: user._id,
      assessmentId: assessment._id,
    })
    .lean();
  if (existing) {
    return json({ curriculum: publicCurriculum(existing), existed: true });
  }

  const output = await runCurriculumAgent({
    domain: assessment.domain,
    refinedTopic: assessment.refinedTopic,
    result: assessment.result,
  });

  const doc = buildCurriculumDoc({
    userId: user._id,
    assessmentId: assessment._id,
    domain: assessment.domain,
    result: assessment.result,
    output,
  });

  // Normalize statuses/ordering via the adaptation pass before persisting.
  const { modules } = adaptCurriculum(doc);
  doc.modules = modules;

  await curricula.create(doc);

  const onboarding = await onboardingCollection();
  await onboarding.updateOne(
    { _id: assessment.onboardingId },
    { $set: { status: "learning", updatedAt: new Date() } },
  );

  return json({ curriculum: publicCurriculum(doc), existed: false }, 201);
});
