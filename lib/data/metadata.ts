/**
 * Page titles that name what you're looking at ("Tutor · SQL basics"). Owner-
 * scoped reads only: a foreign or missing id yields the bare page name, never
 * another learner's topic title.
 */
import "server-only";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/current";
import { locateLesson, resolveCurriculum } from "@/lib/server/curriculumLocate";
import { tidyCurriculumTitle } from "@/lib/domain/title";

export async function topicPageMetadata(
  page: string,
  searchParams: Promise<{ id?: string | string[] }>,
): Promise<Metadata> {
  const user = await getCurrentUser();
  if (!user) return { title: page };
  const { id } = await searchParams;
  const curriculum = await resolveCurriculum(user._id, typeof id === "string" ? id : null);
  return { title: curriculum ? `${page} · ${tidyCurriculumTitle(curriculum.title)}` : page };
}

export async function lessonPageMetadata(params: Promise<{ lessonId: string }>): Promise<Metadata> {
  const user = await getCurrentUser();
  if (!user) return { title: "Lesson" };
  const located = await locateLesson(user._id, (await params).lessonId);
  return { title: located ? located.lesson.title : "Lesson" };
}
