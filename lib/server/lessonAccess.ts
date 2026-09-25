import type { CurriculumDoc } from "@/lib/db/models";
import { gateModuleStatuses } from "@/lib/domain/adapt";
import { forbidden, notFound } from "@/lib/http";

/** Recompute the same access window used by the dashboard, including legacy docs. */
export function findLessonAccess(curriculum: CurriculumDoc, lessonRef: string) {
  for (const mod of gateModuleStatuses(curriculum.modules)) {
    const lesson = mod.lessons.find((item) => item.id === lessonRef);
    if (lesson) return { module: mod, lesson };
  }
  return null;
}

export function requireLessonAccess(curriculum: CurriculumDoc, lessonRef: string) {
  const located = findLessonAccess(curriculum, lessonRef);
  if (!located) throw notFound("Lesson not found in curriculum");
  if (located.module.status === "locked") {
    throw forbidden("This module is locked. Complete earlier modules to unlock it.");
  }
  return located.lesson;
}
