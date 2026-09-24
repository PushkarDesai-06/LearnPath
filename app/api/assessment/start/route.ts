/**
 * Start or resume the learner's assessment quiz for their current clarified
 * topic. The /assessment page renders resume/result states server-side via
 * `readAssessmentState`; the client only POSTs here when a FRESH quiz must be
 * generated (an LLM call), though every state is still reported for safety.
 */
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth/guards";
import {
  assessmentsCollection,
  onboardingCollection,
} from "@/lib/db/collections";
import { DIFFICULTY_LEVELS, type AssessmentDoc } from "@/lib/db/models";
import { ROUND1_LEVELS } from "@/lib/domain/assessment";
import { generateQuizRound, publicQuestion } from "@/lib/server/assessmentFlow";
import { assessmentStateOf, loadAssessmentContext } from "@/lib/data/assessment";
import { badRequest, handler, json } from "@/lib/http";

export const POST = handler(async () => {
  const user = await requireUser();

  const ctx = await loadAssessmentContext(user._id);
  const state = assessmentStateOf(ctx);
  const ob = ctx.onboarding;
  if (state.kind === "no_onboarding" || !ob) {
    throw badRequest(
      "Finish onboarding (clarify your topic) before starting the assessment",
    );
  }
  if (state.kind === "complete") {
    return json({
      assessmentId: state.assessmentId,
      complete: true,
      score: state.score,
      result: { estimatedLevel: state.estimatedLevel },
      review: state.review,
    });
  }
  if (state.kind === "in_progress") {
    return json({
      assessmentId: state.assessmentId,
      complete: false,
      questions: state.questions,
      round: 1,
    });
  }

  const onboarding = await onboardingCollection();
  const assessments = await assessmentsCollection();

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
