import type { DashboardModule, DashboardLesson } from "@/lib/data/types";
import type { DashboardPrefs } from "@/lib/db/models";
import type { StatusIconStatus } from "@/components/StatusIcon";

export type GroupStatus =
  | "needs_review"
  | "in_progress"
  | "available"
  | "mastered"
  | "locked";

export const STATUS_ORDER: GroupStatus[] = [
  "needs_review",
  "in_progress",
  "available",
  "mastered",
  "locked",
];

export const STATUS_LABELS: Record<GroupStatus, string> = {
  needs_review: "Needs review",
  in_progress: "In progress",
  available: "Available",
  mastered: "Mastered",
  locked: "Locked",
};

export interface ListLesson extends DashboardLesson {
  moduleId: string;
  moduleTitle: string;
  displayStatus: GroupStatus;
  locked: boolean;
}

export interface ListGroup {
  key: string;
  anchorId: string;
  kind: "module" | "status";
  title: string;
  /** Set for module groups, null for status groups. */
  moduleId: string | null;
  status: StatusIconStatus;
  /** 0..1, drives the pie of an in progress module. */
  mastery: number;
  mastered: number;
  total: number;
  summary: string | null;
  lessons: ListLesson[];
}

export interface LessonOverride {
  status: string;
  masteryScore: number;
}

function toGroupStatus(status: string): GroupStatus {
  return (STATUS_ORDER as string[]).includes(status)
    ? (status as GroupStatus)
    : "available";
}

function flatten(
  modules: DashboardModule[],
  overrides: Record<string, LessonOverride>,
): ListLesson[] {
  return modules.flatMap((module) =>
    module.lessons.map((lesson) => {
      const override = overrides[lesson.id];
      const merged = override ? { ...lesson, ...override } : lesson;
      const locked = module.status === "locked" || merged.status === "locked";
      return {
        ...merged,
        moduleId: module.id,
        moduleTitle: module.title,
        locked,
        displayStatus: locked ? "locked" : toGroupStatus(merged.status),
      } satisfies ListLesson;
    }),
  );
}

function visible(lesson: ListLesson, prefs: DashboardPrefs) {
  if (prefs.hideMastered && lesson.displayStatus === "mastered") return false;
  if (prefs.hideLocked && lesson.locked) return false;
  return true;
}

/** The list the dashboard renders: groups of lessons, with the view options applied. */
export function buildGroups(
  modules: DashboardModule[],
  prefs: DashboardPrefs,
  overrides: Record<string, LessonOverride> = {},
): ListGroup[] {
  const lessons = flatten(modules, overrides);

  if (prefs.groupBy === "status") {
    return STATUS_ORDER.flatMap((status) => {
      const inGroup = lessons.filter(
        (lesson) => lesson.displayStatus === status && visible(lesson, prefs),
      );
      if (inGroup.length === 0) return [];
      return {
        key: `status:${status}`,
        anchorId: `status-${status}`,
        kind: "status" as const,
        title: STATUS_LABELS[status],
        moduleId: null,
        status,
        mastery: 0,
        mastered: status === "mastered" ? inGroup.length : 0,
        total: inGroup.length,
        summary: null,
        lessons: inGroup,
      };
    });
  }

  return modules.flatMap((module) => {
    const inModule = lessons.filter(
      (lesson) => lesson.moduleId === module.id && visible(lesson, prefs),
    );
    if (inModule.length === 0) return [];
    return {
      key: `module:${module.id}`,
      anchorId: `mod-${module.id}`,
      kind: "module" as const,
      title: module.title,
      moduleId: module.id,
      status: module.status as StatusIconStatus,
      mastery: module.mastery,
      mastered: lessons.filter(
        (lesson) =>
          lesson.moduleId === module.id && lesson.displayStatus === "mastered",
      ).length,
      total: module.lessonsTotal,
      summary: prefs.showSummaries ? module.summary : null,
      lessons: inModule,
    };
  });
}
