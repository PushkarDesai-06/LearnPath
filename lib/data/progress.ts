/**
 * Dashboard aggregate: module/mastery/time stats + recommended next step,
 * derived from a topic's curriculum and the progressEvents log.
 * Absorbs the former `GET /api/progress`.
 */
import "server-only";
import { ObjectId } from "mongodb";
import { progressEventsCollection } from "@/lib/db/collections";
import { resolveCurriculum } from "@/lib/server/curriculumLocate";
import { generatedLessonRefs } from "@/lib/server/lessonReady";
import { summarizeCurriculum } from "@/lib/server/curriculumView";
import { gateModuleStatuses } from "@/lib/domain/adapt";
import { recommendNext } from "@/lib/domain/next";
import type { DashboardData } from "@/lib/data/types";
import { flashcardCounts } from "@/lib/data/flashcards";
import { tidyCurriculumTitle } from "@/lib/domain/title";


/**
 * `curriculumId` selects a topic (owner-scoped — a foreign id resolves to
 * "no curriculum"); omitting it falls back to the newest one.
 */
export async function getDashboard(
  userId: string,
  curriculumId?: string | null,
): Promise<DashboardData> {
  const uid = new ObjectId(userId);
  const curriculum = await resolveCurriculum(uid, curriculumId);
  if (!curriculum) return { hasCurriculum: false };

  // Apply the access window so module badges + recommended-next reflect the rule.
  curriculum.modules = gateModuleStatuses(curriculum.modules);

  // The readiness, time and flashcard reads are independent.
  const events = await progressEventsCollection();
  const [generated, timeAgg, flashcards] = await Promise.all([
    generatedLessonRefs(uid, curriculum._id),
    events.aggregate<{ _id: null; total: number }>([
      {
        $match: {
          userId: uid,
          curriculumId: curriculum._id,
          timeSpentMs: { $exists: true },
        },
      },
      { $group: { _id: null, total: { $sum: "$timeSpentMs" } } },
    ]),
    flashcardCounts(uid, curriculum._id),
  ]);
  const totalTimeMs = timeAgg[0]?.total ?? 0;

  const modules = curriculum.modules.map((m) => {
    const done = m.lessons.filter((l) => l.status === "mastered").length;
    const avg =
      m.lessons.length > 0
        ? m.lessons.reduce((s, l) => s + l.masteryScore, 0) / m.lessons.length
        : 0;
    return {
      id: m.id,
      title: m.title,
      summary: m.summary,
      status: m.status,
      lessonsTotal: m.lessons.length,
      lessonsMastered: done,
      mastery: Number(avg.toFixed(3)),
      lessons: [...m.lessons]
        .sort((a, b) => a.order - b.order)
        .map((l) => ({
          id: l.id,
          title: l.title,
          status: l.status,
          difficultyLevel: l.difficultyLevel,
          estMinutes: l.estMinutes,
          masteryScore: Number(l.masteryScore.toFixed(3)),
          generated: generated.has(l.id),
        })),
    };
  });

  const recommendation = recommendNext(curriculum.modules);

  return {
    hasCurriculum: true,
    curriculumId: curriculum._id.toHexString(),
    title: tidyCurriculumTitle(curriculum.title),
    version: curriculum.version,
    summary: { ...summarizeCurriculum(curriculum), totalTimeMs },
    modules,
    recommendedNext: recommendation
      ? {
          reason: recommendation.reason,
          moduleId: recommendation.moduleId,
          moduleTitle: recommendation.moduleTitle,
          lessonId: recommendation.lesson.id,
          lessonTitle: recommendation.lesson.title,
          generated: generated.has(recommendation.lesson.id),
          started: recommendation.lesson.status === "in_progress",
          masteryScore: Number(recommendation.lesson.masteryScore.toFixed(3)),
        }
      : null,
    flashcards,
  };
}
