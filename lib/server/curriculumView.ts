/**
 * Public projection of a curriculum for API responses (ObjectIds -> strings).
 */
import type { CurriculumDoc } from "@/lib/db/models";

/**
 * Pure progress rollup for one curriculum (no I/O). Shared by the topics list
 * and the per-topic dashboard so both report the same numbers.
 */
export function summarizeCurriculum(doc: CurriculumDoc) {
  const allLessons = doc.modules.flatMap((m) => m.lessons);
  const overallMastery =
    allLessons.length > 0
      ? allLessons.reduce((s, l) => s + l.masteryScore, 0) / allLessons.length
      : 0;
  return {
    modulesTotal: doc.modules.length,
    modulesCompleted: doc.modules.filter((m) => m.status === "completed").length,
    lessonsTotal: allLessons.length,
    lessonsMastered: allLessons.filter((l) => l.status === "mastered").length,
    lessonsNeedingReview: allLessons.filter((l) => l.status === "needs_review")
      .length,
    overallMastery: Number(overallMastery.toFixed(3)),
  };
}

/** Compact projection of a curriculum for the topics list. */
export function topicListItem(doc: CurriculumDoc) {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    domain: doc.domain,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    summary: summarizeCurriculum(doc),
  };
}

export function publicCurriculum(doc: CurriculumDoc) {
  return {
    id: doc._id.toHexString(),
    assessmentId: doc.assessmentId.toHexString(),
    domain: doc.domain,
    title: doc.title,
    version: doc.version,
    modules: doc.modules.map((m) => ({
      id: m.id,
      title: m.title,
      summary: m.summary,
      order: m.order,
      prerequisites: m.prerequisites,
      status: m.status,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        objectives: l.objectives,
        order: l.order,
        estMinutes: l.estMinutes,
        difficultyLevel: l.difficultyLevel,
        topics: l.topics,
        contentGenerated: l.contentGenerated,
        status: l.status,
        masteryScore: Number(l.masteryScore.toFixed(3)),
      })),
    })),
  };
}
