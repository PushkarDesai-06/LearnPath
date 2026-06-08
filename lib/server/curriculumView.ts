/**
 * Public projection of a curriculum for API responses (ObjectIds -> strings).
 */
import type { CurriculumDoc } from "@/lib/db/models";

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
