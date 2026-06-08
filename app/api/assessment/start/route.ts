/**
 * Start (or resume) the adaptive assessment for the learner's current,
 * clarified learning goal. Returns the first/pending question.
 */
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth/guards";
import {
  assessmentsCollection,
  onboardingCollection,
} from "@/lib/db/collections";
import type { AssessmentDoc } from "@/lib/db/models";
import { initialSearchState } from "@/lib/domain/assessment";
import {
  generateNextQuestion,
  publicQuestion,
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

  // Resume an in-progress assessment for this onboarding if one exists.
  const existing = await assessments
    .findOne({
      userId: user._id,
      onboardingId: ob._id,
      state: "in_progress",
    })
    .lean();
  if (existing) {
    const pending = existing.questions.find((q) => q.answer === undefined);
    if (pending) {
      return json({
        assessmentId: existing._id.toHexString(),
        question: publicQuestion(pending),
        answered: existing.questions.filter((q) => q.answer !== undefined)
          .length,
        cap: existing.questionCap,
        resumed: true,
      });
    }
  }

  const search = initialSearchState();
  const now = new Date();
  const doc: AssessmentDoc = {
    _id: new ObjectId(),
    userId: user._id,
    onboardingId: ob._id,
    domain: ob.domain ?? ob.rawDescription,
    refinedTopic: ob.refinedTopic ?? ob.rawDescription,
    state: "in_progress",
    levels: search.levels,
    lowIdx: search.lowIdx,
    highIdx: search.highIdx,
    currentLevelIdx: search.currentLevelIdx,
    pendingConfirm: search.pendingConfirm,
    questionCap: search.questionCap,
    askedTopics: [],
    questions: [],
    createdAt: now,
    updatedAt: now,
  };

  const question = await generateNextQuestion(doc);
  doc.questions.push(question);
  doc.askedTopics.push(question.topic);

  await assessments.create(doc);
  await onboarding.updateOne(
    { _id: ob._id },
    { $set: { status: "assessing", updatedAt: now } },
  );

  return json({
    assessmentId: doc._id.toHexString(),
    question: publicQuestion(question),
    answered: 0,
    cap: doc.questionCap,
    resumed: false,
  });
});
