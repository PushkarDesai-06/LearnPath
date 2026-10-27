import { describe, expect, it } from "vitest";
import { findLessonAccess, requireLessonAccess } from "@/lib/server/lessonAccess";
import { curriculumFixture, lessonFixture } from "../helpers/curriculum";

describe("server module access", () => {
  it("recomputes the window rather than trusting stored module statuses", () => {
    const curriculum = curriculumFixture();
    curriculum.modules = Array.from({ length: 4 }, (_, i) => ({
      id: `m${i}`, title: `Module ${i}`, summary: "", prerequisites: [], order: i,
      status: "available", lessons: [lessonFixture(`l${i}`)],
    }));
    expect(requireLessonAccess(curriculum, "l0").id).toBe("l0");
    expect(requireLessonAccess(curriculum, "l1").id).toBe("l1");
    expect(() => requireLessonAccess(curriculum, "l2")).toThrow(expect.objectContaining({ status: 403 }));
    expect(findLessonAccess(curriculum, "l3")?.module.status).toBe("locked");
    expect(() => requireLessonAccess(curriculum, "missing")).toThrow(expect.objectContaining({ status: 404 }));
  });

  it("keeps mastered modules accessible and opens the next incomplete modules", () => {
    const curriculum = curriculumFixture();
    curriculum.modules = Array.from({ length: 4 }, (_, i) => ({
      id: `m${i}`, title: `Module ${i}`, summary: "", prerequisites: [], order: i,
      status: "locked", lessons: [lessonFixture(`l${i}`)],
    }));
    curriculum.modules[0].lessons[0].status = "mastered";
    curriculum.modules[0].lessons[0].masteryScore = 1;
    expect(requireLessonAccess(curriculum, "l0").id).toBe("l0");
    expect(requireLessonAccess(curriculum, "l2").id).toBe("l2");
    expect(() => requireLessonAccess(curriculum, "l3")).toThrow(expect.objectContaining({ status: 403 }));
  });
});
