/**
 * Dashboard aggregate: module/mastery/time stats + recommended next step,
 * derived from a topic's curriculum and the progressEvents log.
 * Absorbs the former `GET /api/progress`.
 */
import "server-only";
import { ObjectId } from "mongodb";
import { progressEventsCollection } from "@/lib/db/collections";
import type { CurriculumLesson } from "@/lib/db/models";
import { resolveCurriculum } from "@/lib/server/curriculumLocate";
import { generatedLessonRefs } from "@/lib/server/lessonReady";
import { summarizeCurriculum } from "@/lib/server/curriculumView";
import { gateModuleStatuses } from "@/lib/domain/adapt";
import type { DashboardData } from "@/lib/data/types";

type Pick = { moduleId: string; moduleTitle: string; lesson: CurriculumLesson };

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

  const reviewLessons: Pick[] = curriculum.modules.flatMap((m) =>
    m.lessons
      .filter((l) => l.status === "needs_review")
      .map((l) => ({ moduleId: m.id, moduleTitle: m.title, lesson: l })),
  );

  // The readiness aggregation and the time aggregation are independent.
  const events = await progressEventsCollection();
  const [generated, timeAgg] = await Promise.all([
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

  // Recommended next: pending reviews first, else weakest non-done lesson in an
  // unlocked, incomplete module.
  const pickWeakest = (): Pick | null => {
    let best: Pick | null = null;
    for (const m of curriculum.modules) {
      if (m.status === "locked" || m.status === "completed") continue;
      for (const l of m.lessons) {
        if (l.status === "mastered") continue;
        if (!best || l.masteryScore < best.lesson.masteryScore) {
          best = { moduleId: m.id, moduleTitle: m.title, lesson: l };
        }
      }
    }
    return best;
  };
  const recommendation = reviewLessons[0] ?? pickWeakest();

  return {
    hasCurriculum: true,
    curriculumId: curriculum._id.toHexString(),
    title: curriculum.title,
    version: curriculum.version,
    summary: { ...summarizeCurriculum(curriculum), totalTimeMs },
    modules,
    recommendedNext: recommendation
      ? {
          reason:
            recommendation === reviewLessons[0]
              ? "needs_review"
              : "weakest_available",
          moduleId: recommendation.moduleId,
          moduleTitle: recommendation.moduleTitle,
          lessonId: recommendation.lesson.id,
          lessonTitle: recommendation.lesson.title,
          generated: generated.has(recommendation.lesson.id),
          masteryScore: Number(recommendation.lesson.masteryScore.toFixed(3)),
        }
      : null,
  };
}
