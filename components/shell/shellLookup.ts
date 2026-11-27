import type { ShellData, ShellModule, ShellTopic } from "@/lib/data/types";

export interface LessonContext {
  topic: ShellTopic;
  module: ShellModule;
  lessonTitle: string;
}

/** Where a lesson sits in the learner's topics, for breadcrumbs. */
export function findLessonContext(
  topics: ShellData["topics"],
  lessonId: string,
): LessonContext | null {
  for (const topic of topics) {
    for (const mod of topic.modules) {
      const lesson = mod.lessons.find((l) => l.id === lessonId);
      if (lesson) return { topic, module: mod, lessonTitle: lesson.title };
    }
  }
  return null;
}
