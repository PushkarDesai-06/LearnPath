/**
 * Grade an inline practice question, update the lesson's mastery (EWMA), and
 * reveal the explanation. Weak performance flips the lesson to needs_review.
 */
import { z } from "zod";
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth/guards";
import {
  curriculaCollection,
  lessonsCollection,
  progressEventsCollection,
} from "@/lib/db/collections";
import { runAnswerGradeAgent } from "@/lib/ai/agents/grading";
import { lessonStatusFor, updateMastery } from "@/lib/domain/mastery";
import { gradeMcq, outcomeFromGrade } from "@/lib/server/grade";
import { locateLesson } from "@/lib/server/curriculumLocate";
import { handler, json, notFound, readJson } from "@/lib/http";

const Body = z.object({
  questionId: z.string(),
  answer: z.string().min(1),
});

export const POST = handler(
  async (request, ctx: { params: Promise<{ lessonId: string }> }) => {
    const { lessonId } = await ctx.params;
    const user = await requireUser();
    const { questionId, answer } = await readJson(request, Body);

    const lessons = await lessonsCollection();
    const lessonDoc = await lessons
      .findOne({ userId: user._id, lessonRef: lessonId })
      .lean();
    if (!lessonDoc) throw notFound("Lesson content not found — open the lesson first");

    const block = lessonDoc.blocks.find(
      (b) => b.kind === "practice" && b.questionId === questionId,
    );
    if (!block) throw notFound("Practice question not found");

    // --- grade ---
    let correct: boolean;
    let confidence: number;
    let feedback: string | null = null;
    if (block.type === "mcq") {
      correct = gradeMcq(answer, block.correctKey, block.choices);
      confidence = 1;
    } else {
      const grade = await runAnswerGradeAgent({
        prompt: block.prompt ?? lessonDoc.title,
        rubric: block.rubric ?? "A correct answer to the practice question.",
        learnerAnswer: answer,
      });
      correct = grade.correct;
      confidence = grade.confidence;
      feedback = grade.feedback;
    }

    // --- update mastery ---
    const located = await locateLesson(user._id, lessonId);
    if (!located) throw notFound("Lesson not found in curriculum");
    const { curriculum, lesson } = located;

    const outcome = outcomeFromGrade(correct, confidence);
    const newScore = updateMastery(lesson.masteryScore, outcome);
    const newStatus = lessonStatusFor(newScore, true);

    const curricula = await curriculaCollection();
    await curricula.collection.updateOne(
      { _id: curriculum._id },
      {
        $set: {
          "modules.$[].lessons.$[l].masteryScore": newScore,
          "modules.$[].lessons.$[l].status": newStatus,
          updatedAt: new Date(),
        },
      },
      { arrayFilters: [{ "l.id": lessonId }] },
    );

    const events = await progressEventsCollection();
    const now = new Date();
    await events.create({
      _id: new ObjectId(),
      userId: user._id,
      curriculumId: curriculum._id,
      lessonRef: lessonId,
      type: "practice_answered",
      topics: lesson.topics,
      correct,
      score: newScore,
      at: now,
    });
    if (newStatus === "needs_review") {
      await events.create({
        _id: new ObjectId(),
        userId: user._id,
        curriculumId: curriculum._id,
        lessonRef: lessonId,
        type: "review_triggered",
        topics: lesson.topics,
        at: now,
      });
    }

    return json({
      correct,
      feedback,
      explanation: block.explanation ?? null,
      masteryScore: Number(newScore.toFixed(3)),
      status: newStatus,
    });
  },
);
