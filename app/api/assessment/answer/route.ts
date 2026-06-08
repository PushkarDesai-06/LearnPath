/**
 * Submit an answer to the current assessment question. Grades it (MCQ by key,
 * short-answer by the grader agent), advances the adaptive binary search, and
 * returns either the next question or the final diagnosis.
 */
import { z } from "zod";
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth/guards";
import { assessmentsCollection } from "@/lib/db/collections";
import { runAnswerGradeAgent } from "@/lib/ai/agents/grading";
import { computeResult, isComplete, stepSearch } from "@/lib/domain/assessment";
import { gradeMcq } from "@/lib/server/grade";
import {
  generateNextQuestion,
  publicQuestion,
} from "@/lib/server/assessmentFlow";
import { badRequest, handler, json, notFound, readJson } from "@/lib/http";

const Body = z.object({
  assessmentId: z.string(),
  questionId: z.string(),
  answer: z.string().min(1),
});

export const POST = handler(async (request) => {
  const user = await requireUser();
  const { assessmentId, questionId, answer } = await readJson(request, Body);

  if (!ObjectId.isValid(assessmentId)) throw badRequest("Invalid assessmentId");

  const assessments = await assessmentsCollection();
  const doc = await assessments
    .findOne({
      _id: new ObjectId(assessmentId),
      userId: user._id,
    })
    .lean();
  if (!doc) throw notFound("Assessment not found");
  if (doc.state === "complete") throw badRequest("Assessment already complete");

  const question = doc.questions.find((q) => q.id === questionId);
  if (!question) throw notFound("Question not found");
  if (question.answer !== undefined)
    throw badRequest("That question was already answered");

  // --- grade ---
  let correct: boolean;
  let confidence: number;
  let feedback: string | null = null;
  if (question.type === "mcq") {
    correct = gradeMcq(answer, question.correctKey, question.choices);
    confidence = 1;
  } else {
    const grade = await runAnswerGradeAgent({
      prompt: question.prompt,
      rubric: question.rubric ?? "A correct, complete answer to the question.",
      learnerAnswer: answer,
    });
    correct = grade.correct;
    confidence = grade.confidence;
    feedback = grade.feedback;
  }

  question.answer = answer;
  question.correct = correct;
  question.confidence = confidence;

  // --- advance the adaptive search ---
  const step = stepSearch(
    {
      lowIdx: doc.lowIdx,
      highIdx: doc.highIdx,
      currentLevelIdx: doc.currentLevelIdx,
      pendingConfirm: doc.pendingConfirm,
    },
    correct,
  );
  doc.lowIdx = step.next.lowIdx;
  doc.highIdx = step.next.highIdx;
  doc.currentLevelIdx = step.next.currentLevelIdx;
  doc.pendingConfirm = step.next.pendingConfirm;
  doc.updatedAt = new Date();

  const finished =
    step.finished ||
    isComplete({
      lowIdx: doc.lowIdx,
      highIdx: doc.highIdx,
      questions: doc.questions,
      questionCap: doc.questionCap,
    });

  if (finished) {
    doc.state = "complete";
    doc.result = computeResult(doc);
    await assessments.replaceOne({ _id: doc._id }, doc);
    return json({
      done: true,
      correct,
      feedback,
      result: doc.result,
    });
  }

  // --- next question ---
  const next = await generateNextQuestion(doc);
  doc.questions.push(next);
  if (!doc.askedTopics.includes(next.topic)) doc.askedTopics.push(next.topic);
  await assessments.replaceOne({ _id: doc._id }, doc);

  return json({
    done: false,
    correct,
    feedback,
    question: publicQuestion(next),
    answered: doc.questions.filter((q) => q.answer !== undefined).length,
    cap: doc.questionCap,
  });
});
