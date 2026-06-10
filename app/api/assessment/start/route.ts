/**
 * Start, resume, or report the learner's assessment quiz for their current
 * clarified topic. The quiz is generated once and persisted, so it is fully
 * resumable — leaving and coming back returns the same questions (it doesn't
 * "disappear"). A completed-but-not-yet-generated assessment returns its result.
 */
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth/guards";
import {
  assessmentsCollection,
  onboardingCollection,
} from "@/lib/db/collections";
import { DIFFICULTY_LEVELS, type AssessmentDoc } from "@/lib/db/models";
import { ROUND1_LEVELS } from "@/lib/domain/assessment";
import {
  generateQuizRound,
  publicQuestion,
  reviewItem,
} from "@/lib/server/assessmentFlow";
import { badRequest, handler, json } from "@/lib/http";

export const POST = handler(async () => {
  const user = await requireUser();

  const onboarding = await onboardingCollection();
  const ob = await onboarding
    .findOne({ userId: user._id, status: { $in: ["ready", "assessing"] } })
    .sort({ updatedAt: -1 })
    .lean();
  if (!ob) {
    throw badRequest(
      "Finish onboarding (clarify your topic) before starting the assessment",
    );
  }

  const assessments = await assessmentsCollection();
  const existing = await assessments
    .findOne({ userId: user._id, onboardingId: ob._id })
    .sort({ createdAt: -1 })
    .lean();

  // Already graded → return the result + review (don't start a new quiz).
  if (existing && existing.state === "complete" && existing.result) {
    return json({
      assessmentId: existing._id.toHexString(),
      complete: true,
      score: existing.result.score,
      result: existing.result,
      review: existing.questions
        .filter((q) => q.answer !== undefined)
        .map(reviewItem),
    });
  }

  // Resume an in-progress quiz.
  if (existing && existing.state === "in_progress") {
    const pending = existing.questions.filter((q) => q.answer === undefined);
    return json({
      assessmentId: existing._id.toHexString(),
      complete: false,
      questions: pending.map(publicQuestion),
      round: 1,
    });
  }

  // Fresh quiz.
  const now = new Date();
  const questions = await generateQuizRound({
    domain: ob.domain ?? ob.rawDescription,
    refinedTopic: ob.refinedTopic ?? ob.rawDescription,
    round: 1,
    levels: ROUND1_LEVELS,
  });

  const doc: AssessmentDoc = {
    _id: new ObjectId(),
    userId: user._id,
    onboardingId: ob._id,
    domain: ob.domain ?? ob.rawDescription,
    refinedTopic: ob.refinedTopic ?? ob.rawDescription,
    state: "in_progress",
    levels: DIFFICULTY_LEVELS,
    rounds: 1,
    questions,
    createdAt: now,
    updatedAt: now,
  };
  await assessments.create(doc);
  await onboarding.updateOne(
    { _id: ob._id },
    { $set: { status: "assessing", updatedAt: now } },
  );

  return json({
    assessmentId: doc._id.toHexString(),
    complete: false,
    questions: questions.map(publicQuestion),
    round: 1,
  });
});
