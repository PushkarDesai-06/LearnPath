/**
 * Submit a whole quiz round at once. Grades every answer server-side (MCQ by
 * key), produces a complete, usable result (score + estimated level), and only
 * when results look noisy (non-monotonic across bands) appends ONE optional
 * refinement round. There is no half-finished state — round 1 always finalizes.
 */
import { z } from "zod";
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth/guards";
import { assessmentsCollection } from "@/lib/db/collections";
import {
  MAX_ROUNDS,
  computeResult,
  estimateLevelIdx,
  recommendAnotherRound,
  round2Levels,
} from "@/lib/domain/assessment";
import { gradeMcq } from "@/lib/server/grade";
import {
  generateQuizRound,
  publicQuestion,
  reviewItem,
} from "@/lib/server/assessmentFlow";
import { badRequest, handler, json, notFound, readJson } from "@/lib/http";

const Body = z.object({
  assessmentId: z.string(),
  answers: z
    .array(z.object({ questionId: z.string(), answer: z.string().min(1) }))
    .min(1),
});

export const POST = handler(async (request) => {
  const user = await requireUser();
  const { assessmentId, answers } = await readJson(request, Body);
  if (!ObjectId.isValid(assessmentId)) throw badRequest("Invalid assessmentId");

  const assessments = await assessmentsCollection();
  const doc = await assessments
    .findOne({ _id: new ObjectId(assessmentId), userId: user._id })
    .lean();
  if (!doc) throw notFound("Assessment not found");

  // Grade the submitted answers (only previously-unanswered questions).
  const byId = new Map(doc.questions.map((q) => [q.id, q]));
  for (const { questionId, answer } of answers) {
    const q = byId.get(questionId);
    if (!q || q.answer !== undefined) continue;
    q.answer = answer;
    q.correct = gradeMcq(answer, q.correctKey, q.choices);
  }

  const result = computeResult(doc);
  doc.result = result;
  doc.state = "complete";
  doc.updatedAt = new Date();

  // Offer a refinement round only when results look noisy, and only once.
  const recommend =
    doc.rounds < MAX_ROUNDS && recommendAnotherRound(doc.questions);
  let nextQuestions: ReturnType<typeof publicQuestion>[] = [];
  if (recommend) {
    const r2 = await generateQuizRound({
      domain: doc.domain,
      refinedTopic: doc.refinedTopic,
      round: doc.rounds + 1,
      levels: round2Levels(estimateLevelIdx(doc.questions)),
      avoidTopics: [...new Set(doc.questions.map((q) => q.topic))],
    });
    doc.questions.push(...r2);
    doc.rounds += 1;
    nextQuestions = r2.map(publicQuestion);
  }

  await assessments.replaceOne({ _id: doc._id }, doc);

  return json({
    score: result.score,
    estimatedLevel: result.estimatedLevel,
    result,
    review: doc.questions
      .filter((q) => q.answer !== undefined)
      .map(reviewItem),
    recommendAnotherRound: recommend,
    nextQuestions,
  });
});
