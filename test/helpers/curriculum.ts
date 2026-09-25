import { ObjectId } from "mongodb";
import type { CurriculumDoc, CurriculumLesson } from "@/lib/db/models";

export function lessonFixture(id = "lesson-1"): CurriculumLesson {
  return { id, title: id, objectives: [], order: 0, estMinutes: 10,
    difficultyLevel: "beginner", topics: ["basics"], contentGenerated: true,
    status: "available", masteryScore: 0 };
}

export function curriculumFixture(): CurriculumDoc {
  return {
    _id: new ObjectId(), userId: new ObjectId(), assessmentId: new ObjectId(),
    title: "Topic", domain: "Programming", version: 1, revision: 0,
    createdAt: new Date(), updatedAt: new Date(),
    modules: [{ id: "module-1", title: "Basics", summary: "", order: 0,
      prerequisites: [], status: "available", lessons: [lessonFixture()] }],
  };
}

export function copyCurriculum(doc: CurriculumDoc): CurriculumDoc {
  return { ...doc, modules: structuredClone(doc.modules) };
}
