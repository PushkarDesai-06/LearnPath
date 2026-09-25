/**
 * Grade an inline practice question, update the lesson's mastery (EWMA), and
 * reveal the explanation. Weak performance flips the lesson to needs_review.
 *
 * `countsTowardMastery:false` grades and explains WITHOUT touching mastery or
 * logging an event — that's a replay after the learner reset a question they'd
 * already seen the answer to. Only the first attempt is honest signal.
 */
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { lessonsCollection } from "@/lib/db/collections";
import { runAnswerGradeAgent } from "@/lib/ai/agents/grading";
import { recordPractice } from "@/lib/server/practiceProgress";
import { gradeMcq, outcomeFromGrade } from "@/lib/domain/grade";
import { locateLesson } from "@/lib/server/curriculumLocate";
import { handler, json, notFound, readJson } from "@/lib/http";

const Body = z.object({
  questionId: z.string(),
  answer: z.string().min(1),
  /** False on a replay: grade it, but leave the learner's progress alone. */
  countsTowardMastery: z.boolean().default(true),
});

export const POST = handler(
  async (request, ctx: { params: Promise<{ lessonId: string }> }) => {
    const { lessonId } = await ctx.params;
    const user = await requireUser();
    const { questionId, answer, countsTowardMastery } = await readJson(
      request,
      Body,
    );

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
    const progress = await recordPractice({
      userId: user._id,
      curriculumId: located.curriculum._id,
      lessonId,
      questionId,
      correct,
      outcome: outcomeFromGrade(correct, confidence),
      countsTowardMastery,
    });

    return json({
      correct,
      feedback,
      explanation: block.explanation ?? null,
      ...progress,
      masteryScore: Number(progress.masteryScore.toFixed(3)),
    });
  },
);
