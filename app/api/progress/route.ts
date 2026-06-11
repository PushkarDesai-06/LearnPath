/**
 * Dashboard aggregate: module/mastery/time stats + recommended next steps,
 * derived from the current curriculum and the progressEvents log.
 */
import { requireUser } from "@/lib/auth/guards";
import { progressEventsCollection } from "@/lib/db/collections";
import type { CurriculumLesson } from "@/lib/db/models";
import { resolveCurriculum } from "@/lib/server/curriculumLocate";
import { summarizeCurriculum } from "@/lib/server/curriculumView";
import { gateModuleStatuses } from "@/lib/domain/adapt";
import { handler, json } from "@/lib/http";

export const GET = handler(async (request) => {
  const user = await requireUser();
  const curriculumId = new URL(request.url).searchParams.get("curriculumId");

  const curriculum = await resolveCurriculum(user._id, curriculumId);
  if (!curriculum) {
    return json({ hasCurriculum: false });
  }
  // Apply the access window so module badges + recommended-next reflect the rule.
  curriculum.modules = gateModuleStatuses(curriculum.modules);

  const reviewLessons = curriculum.modules.flatMap((m) =>
    m.lessons
      .filter((l) => l.status === "needs_review")
      .map((l) => ({ moduleId: m.id, moduleTitle: m.title, lesson: l })),
  );

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
      // Lessons so the dashboard can render the navigable path (open lessons).
      lessons: [...m.lessons]
        .sort((a, b) => a.order - b.order)
        .map((l) => ({
          id: l.id,
          title: l.title,
          status: l.status,
          difficultyLevel: l.difficultyLevel,
          estMinutes: l.estMinutes,
          masteryScore: Number(l.masteryScore.toFixed(3)),
        })),
    };
  });

  // Total time spent from the event log.
  const events = await progressEventsCollection();
  const timeAgg = await events.aggregate<{ _id: null; total: number }>([
    {
      $match: {
        userId: user._id,
        curriculumId: curriculum._id,
        timeSpentMs: { $exists: true },
      },
    },
    { $group: { _id: null, total: { $sum: "$timeSpentMs" } } },
  ]);
  const totalTimeMs = timeAgg[0]?.total ?? 0;

  // Recommended next: pending reviews first, else weakest non-done lesson in an
  // unlocked, incomplete module.
  const pickWeakest = (): {
    moduleId: string;
    moduleTitle: string;
    lesson: CurriculumLesson;
  } | null => {
    let best: {
      moduleId: string;
      moduleTitle: string;
      lesson: CurriculumLesson;
    } | null = null;
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

  return json({
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
          masteryScore: Number(recommendation.lesson.masteryScore.toFixed(3)),
        }
      : null,
  });
});
