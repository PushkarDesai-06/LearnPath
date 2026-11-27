/**
 * Everything the app shell (sidebar, command palette) renders: topics with their
 * module tree, archived topics, pinned and recent lessons, and due flashcards.
 * Three queries, all reads. Statuses use the same module gating as the dashboard.
 */
import "server-only";
import { cache } from "react";
import { ObjectId } from "mongodb";
import { curriculaCollection, flashcardsCollection } from "@/lib/db/collections";
import type { CurriculumDoc, LessonRefEntry } from "@/lib/db/models";
import { gateModuleStatuses } from "@/lib/domain/adapt";
import { summarizeCurriculum } from "@/lib/server/curriculumView";
import { prefsDTO, readPrefs } from "@/lib/server/prefs";
import type {
  ShellData,
  ShellLessonLink,
  ShellModule,
  ShellTopic,
} from "@/lib/data/types";

const SHELL_FIELDS = {
  title: 1,
  createdAt: 1,
  archivedAt: 1,
  "modules.id": 1,
  "modules.title": 1,
  "modules.order": 1,
  "modules.status": 1,
  "modules.lessons.id": 1,
  "modules.lessons.title": 1,
  "modules.lessons.order": 1,
  "modules.lessons.status": 1,
  "modules.lessons.masteryScore": 1,
};

function shellModules(curriculum: CurriculumDoc): ShellModule[] {
  return gateModuleStatuses(curriculum.modules).map((m) => ({
    id: m.id,
    title: m.title,
    status: m.status,
    lessonsTotal: m.lessons.length,
    lessonsMastered: m.lessons.filter((l) => l.status === "mastered").length,
    lessons: [...m.lessons]
      .sort((a, b) => a.order - b.order)
      .map((l) => ({
        id: l.id,
        title: l.title,
        status: l.status,
        masteryScore: Number(l.masteryScore.toFixed(3)),
      })),
  }));
}

export const getShellData = cache(async (userId: string): Promise<ShellData> => {
  const uid = new ObjectId(userId);
  const [curricula, cards, prefs] = await Promise.all([
    curriculaCollection().then((c) =>
      c.find({ userId: uid }, SHELL_FIELDS).sort({ createdAt: -1 }).lean(),
    ),
    flashcardsCollection().then((c) =>
      c.aggregate<{ _id: ObjectId; due: number }>([
        { $match: { userId: uid, due: { $lte: new Date() } } },
        { $group: { _id: "$curriculumId", due: { $sum: 1 } } },
      ]),
    ),
    readPrefs(uid),
  ]);

  const dueByTopic = new Map(cards.map((row) => [row._id.toHexString(), row.due]));
  const active = curricula.filter((c) => !c.archivedAt);

  const topics: ShellTopic[] = active.map((c) => ({
    id: c._id.toHexString(),
    title: c.title,
    mastery: summarizeCurriculum(c).overallMastery,
    dueCards: dueByTopic.get(c._id.toHexString()) ?? 0,
    modules: shellModules(c),
  }));

  const archivedTopics = curricula
    .filter((c) => c.archivedAt)
    .sort((a, b) => b.archivedAt!.getTime() - a.archivedAt!.getTime())
    .map((c) => ({
      id: c._id.toHexString(),
      title: c.title,
      archivedAt: c.archivedAt!.toISOString(),
    }));

  const lookup = new Map<string, { topic: ShellTopic; module: ShellModule }>();
  for (const topic of topics) {
    for (const mod of topic.modules) {
      for (const lesson of mod.lessons) {
        lookup.set(`${topic.id}:${lesson.id}`, { topic, module: mod });
      }
    }
  }
  const resolve = (entries: LessonRefEntry[]): ShellLessonLink[] =>
    entries.flatMap((entry) => {
      const curriculumId = entry.curriculumId.toHexString();
      const found = lookup.get(`${curriculumId}:${entry.lessonId}`);
      const lesson = found?.module.lessons.find((l) => l.id === entry.lessonId);
      if (!found || !lesson) return [];
      return [
        {
          curriculumId,
          lessonId: lesson.id,
          title: lesson.title,
          topicTitle: found.topic.title,
          moduleTitle: found.module.title,
          moduleStatus: found.module.status,
          status: lesson.status,
          masteryScore: lesson.masteryScore,
        },
      ];
    });

  return {
    topics,
    archivedTopics,
    pins: resolve(prefs.pinnedLessons),
    recents: resolve(prefs.recentLessons),
    dueCardsTotal: topics.reduce((sum, t) => sum + t.dueCards, 0),
    prefs: prefsDTO(prefs),
  };
});
