/**
 * Helpers to find a lesson within a learner's curricula and to project a lesson
 * to its learner-safe shape (hiding answers until graded).
 */
import { ObjectId } from "mongodb";
import { curriculaCollection } from "@/lib/db/collections";
import type {
  CurriculumDoc,
  CurriculumLesson,
  CurriculumModule,
  LessonBlock,
} from "@/lib/db/models";

export interface LocatedLesson {
  curriculum: CurriculumDoc;
  module: CurriculumModule;
  lesson: CurriculumLesson;
}

export async function locateLesson(
  userId: ObjectId,
  lessonRef: string,
): Promise<LocatedLesson | null> {
  const curricula = await curriculaCollection();
  const curriculum = await curricula
    .findOne({
      userId,
      "modules.lessons.id": lessonRef,
    })
    .lean();
  if (!curriculum) return null;

  for (const mod of curriculum.modules) {
    const lesson = mod.lessons.find((l) => l.id === lessonRef);
    if (lesson) return { curriculum, module: mod, lesson };
  }
  return null;
}

/** Strip answer-revealing fields (correctKey, rubric, explanation) from blocks. */
export function publicLessonBlock(block: LessonBlock) {
  if (block.kind === "practice") {
    return {
      kind: block.kind,
      questionId: block.questionId,
      prompt: block.prompt,
      type: block.type,
      choices: block.choices ?? null,
    };
  }
  const { ...rest } = block;
  return rest;
}
