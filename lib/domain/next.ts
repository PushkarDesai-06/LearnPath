/**
 * What the learner should open next. Pure: the dashboard's "Up next" card and
 * the lesson page's post-completion "Next lesson" both read it, so they can't
 * disagree. Expects modules ALREADY gated (`gateModuleStatuses`).
 *
 * Order of preference: a lesson flagged for review in an open module, then the
 * weakest unmastered lesson in an open, unfinished module. `exclude` skips one
 * lesson (the one just completed).
 */
import type { CurriculumLesson, CurriculumModule } from "@/lib/db/models";

export interface NextPick {
  reason: "needs_review" | "weakest_available";
  moduleId: string;
  moduleTitle: string;
  lesson: CurriculumLesson;
}

export function recommendNext(modules: CurriculumModule[], exclude?: string): NextPick | null {
  for (const m of modules) {
    if (m.status === "locked") continue;
    const review = m.lessons.find((l) => l.status === "needs_review" && l.id !== exclude);
    if (review) return { reason: "needs_review", moduleId: m.id, moduleTitle: m.title, lesson: review };
  }

  let best: NextPick | null = null;
  for (const m of modules) {
    if (m.status === "locked" || m.status === "completed") continue;
    for (const l of m.lessons) {
      if (l.status === "mastered" || l.id === exclude) continue;
      if (!best || l.masteryScore < best.lesson.masteryScore) {
        best = { reason: "weakest_available", moduleId: m.id, moduleTitle: m.title, lesson: l };
      }
    }
  }
  return best;
}
