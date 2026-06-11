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
import { isLessonDone, MASTERED_THRESHOLD } from "@/lib/domain/mastery";
import type {
  CurriculumDoc,
  CurriculumModule,
  ModuleStatus,
} from "@/lib/db/models";

/**
 * How many not-yet-completed modules are accessible at once. Instead of hard-
 * locking everything after the current module until it's 100% mastered, we keep
 * a window of upcoming modules open so the learner can work through at least the
 * next couple in increasing difficulty.
 */
export const OPEN_MODULE_WINDOW = 2;

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
 * Assign each module a status, gating accessibility with a sliding window: every
 * completed module stays `completed`, the next `OPEN_MODULE_WINDOW` incomplete
 * modules (in order) are open (`available`/`in_progress`), and the rest are
 * `locked`. Pure — used both when adapting (write) and when serving (read), so
 * existing curricula reflect the rule without a migration.
 */
export function gateModuleStatuses(
  modules: CurriculumModule[],
): CurriculumModule[] {
  const ordered = [...modules].sort((a, b) => a.order - b.order);
  let open = OPEN_MODULE_WINDOW;
  return ordered.map((m) => {
    const done = m.lessons.length > 0 && m.lessons.every(isLessonDone);
    let status: ModuleStatus;
    if (done) {
      status = "completed";
    } else if (open > 0) {
      const active = m.lessons.some(
        (l) => l.status === "in_progress" || l.status === "needs_review",
      );
      status = active ? "in_progress" : "available";
      open -= 1;
    } else {
      status = "locked";
    }
    return { ...m, status };
  });
}

/**
 * Reorder a curriculum (returns a new modules array) and update every
 * module/lesson status. Returns the updated modules plus whether anything
 * changed (so the caller can decide to bump `version`).
 */
export function adaptCurriculum(curriculum: CurriculumDoc): {
  modules: CurriculumModule[];
  changed: boolean;
} {
  const ordered = orderModules(curriculum.modules);

  const processed = ordered.map((module, moduleIndex) => {
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
    return { ...module, order: moduleIndex, lessons: reLessons };
  });

  const newModules = gateModuleStatuses(processed);
  const changed =
    JSON.stringify(newModules) !== JSON.stringify(curriculum.modules);
  return { modules: newModules, changed };
}
