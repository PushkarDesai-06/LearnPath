import type {
  ShellLessonLink,
  ShellModule,
  ShellTopic,
} from "@/lib/data/types";

export type PaletteGroupId =
  | "suggested"
  | "navigate"
  | "topics"
  | "lessons"
  | "actions"
  | "recent"
  | "archived";

export type PaletteContext = "lesson" | "dashboard" | "other";

const GROUP_ORDER: Record<PaletteContext, PaletteGroupId[]> = {
  lesson: ["actions", "suggested", "navigate", "recent", "topics", "lessons", "archived"],
  dashboard: ["suggested", "lessons", "navigate", "topics", "actions", "recent", "archived"],
  other: ["suggested", "navigate", "recent", "topics", "actions", "lessons", "archived"],
};

const SEARCH_ORDER: PaletteGroupId[] = [
  "lessons",
  "topics",
  "navigate",
  "actions",
  "recent",
  "suggested",
  "archived",
];

export function paletteContext(pathname: string): PaletteContext {
  if (pathname.startsWith("/learn/")) return "lesson";
  if (pathname === "/dashboard") return "dashboard";
  return "other";
}

export function orderGroups(context: PaletteContext, searchMode: boolean) {
  return searchMode ? SEARCH_ORDER : GROUP_ORDER[context];
}

/** Moves entries flagged as lesson actions ahead of the rest, keeping each side's order. */
export function orderActions<T extends { scope: "lesson" | "global" }>(
  actions: T[],
  context: PaletteContext,
) {
  if (context !== "lesson") return actions;
  return [
    ...actions.filter((a) => a.scope === "lesson"),
    ...actions.filter((a) => a.scope !== "lesson"),
  ];
}

export interface LessonEntry {
  lessonId: string;
  title: string;
  status: string;
  masteryScore: number;
  locked: boolean;
  topicId: string;
  topicTitle: string;
  moduleTitle: string;
}

function isLocked(module: ShellModule, status: string) {
  return module.status === "locked" || status === "locked";
}

/** Every lesson of every topic, the active topic's first. */
export function flattenLessons(
  topics: ShellTopic[],
  activeId: string | null,
): LessonEntry[] {
  const ordered = [
    ...topics.filter((t) => t.id === activeId),
    ...topics.filter((t) => t.id !== activeId),
  ];
  return ordered.flatMap((topic) =>
    topic.modules.flatMap((module) =>
      module.lessons.map((lesson) => ({
        lessonId: lesson.id,
        title: lesson.title,
        status: lesson.status,
        masteryScore: lesson.masteryScore,
        locked: isLocked(module, lesson.status),
        topicId: topic.id,
        topicTitle: topic.title,
        moduleTitle: module.title,
      })),
    ),
  );
}

export function findLessonLink(
  topics: ShellTopic[],
  lessonId: string,
): ShellLessonLink | null {
  for (const topic of topics) {
    for (const mod of topic.modules) {
      const lesson = mod.lessons.find((l) => l.id === lessonId);
      if (lesson) {
        return {
          curriculumId: topic.id,
          lessonId: lesson.id,
          title: lesson.title,
          topicTitle: topic.title,
          moduleTitle: mod.title,
          moduleStatus: mod.status,
          status: lesson.status,
          masteryScore: lesson.masteryScore,
        };
      }
    }
  }
  return null;
}

const CONTINUE_PRIORITY = ["needs_review", "in_progress", "available"];

/** The lesson to resume in a topic: needs review first, then in progress, then the next available one. */
export function pickContinueLesson(topic: ShellTopic | undefined) {
  if (!topic) return null;
  const candidates = flattenLessons([topic], topic.id).filter((l) => !l.locked);
  for (const status of CONTINUE_PRIORITY) {
    const match = candidates.find((l) => l.status === status);
    if (match) return match;
  }
  return null;
}

export interface PaletteSuggestions {
  continueLesson: {
    lessonId: string;
    title: string;
    topicTitle: string;
    status: string;
  } | null;
  review: { count: number; topicId: string } | null;
}

export function buildSuggestions(input: {
  topics: ShellTopic[];
  activeId: string | null;
  recents: ShellLessonLink[];
}): PaletteSuggestions {
  const { topics, activeId, recents } = input;
  const recentTopicId = recents[0]?.curriculumId;
  const topic =
    topics.find((t) => t.id === activeId) ??
    topics.find((t) => t.id === recentTopicId) ??
    topics[0];

  const picked = pickContinueLesson(topic);
  const continueLesson = picked
    ? {
        lessonId: picked.lessonId,
        title: picked.title,
        topicTitle: picked.topicTitle,
        status: picked.status,
      }
    : recents[0]
      ? {
          lessonId: recents[0].lessonId,
          title: recents[0].title,
          topicTitle: recents[0].topicTitle,
          status: recents[0].status,
        }
      : null;

  const dueTopic =
    topic && topic.dueCards > 0 ? topic : topics.find((t) => t.dueCards > 0);
  const review = dueTopic ? { count: dueTopic.dueCards, topicId: dueTopic.id } : null;

  return { continueLesson, review };
}
