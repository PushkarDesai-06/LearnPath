/**
 * Curriculum adaptation. Deterministic, explainable reordering of the learning
 * path based on the learner model — the LLM authors content, but never decides
 * ordering.
 *
 * Three rules:
 *   1. Skip mastered — lessons whose mastery is already >= threshold are marked
 *      mastered (done at generation time and re-affirmed here).
 *   2. Revisit weak areas — `needs_review` lessons are hoisted to the front of
 *      their module's available queue.
 *   3. Reorder upcoming — among non-done lessons in a module, sort weakest
 *      mastery first (needs_review before available), while keeping mastered
 *      lessons in place. Module ordering follows the prerequisite DAG.
 */
import {
  isLessonDone,
  MASTERED_THRESHOLD,
  moduleStatusFor,
} from "@/lib/domain/mastery";
import type { CurriculumDoc, CurriculumModule } from "@/lib/db/models";

/** Topological order of modules by their prerequisite ids, stable on `order`. */
export function orderModules(
  modules: CurriculumModule[],
): CurriculumModule[] {
  const byId = new Map(modules.map((m) => [m.id, m]));
  const visited = new Set<string>();
  const result: CurriculumModule[] = [];

  const visit = (m: CurriculumModule, stack: Set<string>) => {
    if (visited.has(m.id) || stack.has(m.id)) return;
    stack.add(m.id);
    for (const prereqId of m.prerequisites) {
      const prereq = byId.get(prereqId);
      if (prereq) visit(prereq, stack);
    }
    stack.delete(m.id);
    visited.add(m.id);
    result.push(m);
  };

  // Visit in declared order so siblings keep their authored sequence.
  for (const m of [...modules].sort((a, b) => a.order - b.order)) {
    visit(m, new Set());
  }
  return result;
}

function lessonPriority(status: string): number {
  // lower = surfaced earlier among non-done lessons
  switch (status) {
    case "needs_review":
      return 0;
    case "in_progress":
      return 1;
    case "available":
      return 2;
    default:
      return 3; // locked
  }
}

/**
 * Reorder a curriculum in place-style (returns a new modules array) and update
 * every module/lesson status. Returns the updated modules plus whether anything
 * changed (so the caller can decide to bump `version`).
 */
export function adaptCurriculum(curriculum: CurriculumDoc): {
  modules: CurriculumModule[];
  changed: boolean;
} {
  const ordered = orderModules(curriculum.modules);
  const completedModuleIds = new Set<string>();

  const newModules = ordered.map((module, moduleIndex) => {
    // Re-affirm mastered lessons (skip-mastered rule).
    const lessons = module.lessons.map((l) => ({
      ...l,
      status:
        l.masteryScore >= MASTERED_THRESHOLD ? ("mastered" as const) : l.status,
    }));

    // Sort: done lessons keep authored order at the top of "done", then
    // non-done lessons weakest-first (needs_review hoisted), tie-break by order.
    const sorted = [...lessons].sort((a, b) => {
      const aDone = isLessonDone(a);
      const bDone = isLessonDone(b);
      if (aDone !== bDone) return aDone ? -1 : 1; // mastered first (already learned)
      if (!aDone) {
        const pa = lessonPriority(a.status);
        const pb = lessonPriority(b.status);
        if (pa !== pb) return pa - pb;
        if (a.masteryScore !== b.masteryScore)
          return a.masteryScore - b.masteryScore; // weaker first
      }
      return a.order - b.order;
    });

    // Re-number order to reflect the new sequence.
    const reLessons = sorted.map((l, i) => ({ ...l, order: i }));

    const prereqsCompleted = module.prerequisites.every((id) =>
      completedModuleIds.has(id),
    );
    const updatedModule: CurriculumModule = {
      ...module,
      order: moduleIndex,
      lessons: reLessons,
      status: moduleStatusFor({ ...module, lessons: reLessons }, prereqsCompleted),
    };
    if (updatedModule.status === "completed")
      completedModuleIds.add(updatedModule.id);
    return updatedModule;
  });

  const changed =
    JSON.stringify(newModules) !== JSON.stringify(curriculum.modules);
  return { modules: newModules, changed };
}
