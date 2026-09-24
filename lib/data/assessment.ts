/**
 * Read side of the assessment: what the learner should see on /assessment.
 * Shared by the server page and `POST /api/assessment/start` (which adds the
 * write path: generating a fresh quiz with the LLM).
 */
import "server-only";
import { ObjectId } from "mongodb";
import {
  assessmentsCollection,
  onboardingCollection,
} from "@/lib/db/collections";
import type { AssessmentDoc, OnboardingDoc } from "@/lib/db/models";
import { publicQuestion, reviewItem } from "@/lib/server/assessmentFlow";
import type { AssessmentState } from "@/lib/data/types";

/** The onboarding + latest assessment the quiz belongs to (raw docs, server-side). */
export async function loadAssessmentContext(userId: ObjectId): Promise<{
  onboarding: OnboardingDoc | null;
  existing: AssessmentDoc | null;
}> {
  const onboarding = await onboardingCollection();
  const ob = await onboarding
    .findOne({ userId, status: { $in: ["ready", "assessing"] } })
    .sort({ updatedAt: -1 })
    .lean();
  if (!ob) return { onboarding: null, existing: null };

  const assessments = await assessmentsCollection();
  const existing = await assessments
    .findOne({ userId, onboardingId: ob._id })
    .sort({ createdAt: -1 })
    .lean();
  return { onboarding: ob, existing };
}

/** Project a loaded context to what the page renders. Pure. */
export function assessmentStateOf(ctx: {
  onboarding: OnboardingDoc | null;
  existing: AssessmentDoc | null;
}): AssessmentState {
  const { onboarding, existing } = ctx;
  if (!onboarding) return { kind: "no_onboarding" };
  if (existing && existing.state === "complete" && existing.result) {
    return {
      kind: "complete",
      assessmentId: existing._id.toHexString(),
      score: existing.result.score,
      estimatedLevel: existing.result.estimatedLevel,
      review: existing.questions
        .filter((q) => q.answer !== undefined)
        .map(reviewItem),
    };
  }
  if (existing && existing.state === "in_progress") {
    return {
      kind: "in_progress",
      assessmentId: existing._id.toHexString(),
      questions: existing.questions
        .filter((q) => q.answer === undefined)
        .map(publicQuestion),
    };
  }
  return { kind: "fresh" };
}

export async function readAssessmentState(
  userId: string,
): Promise<AssessmentState> {
  return assessmentStateOf(await loadAssessmentContext(new ObjectId(userId)));
}
