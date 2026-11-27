/** Record a lesson visit. Called from a client effect on mount, never from a render. */
import { requireUser } from "@/lib/auth/guards";
import { addRecent } from "@/lib/domain/prefs";
import { handler, json, readJson } from "@/lib/http";
import {
  lessonRefBody,
  lessonRefsDTO,
  mutatePrefs,
  requireOwnedLesson,
} from "@/lib/server/prefs";

export const POST = handler(async (request) => {
  const user = await requireUser();
  const { curriculumId, lessonId } = await readJson(request, lessonRefBody);
  const id = await requireOwnedLesson(user._id, curriculumId, lessonId);

  const recents = await mutatePrefs(user._id, (prefs) => {
    const next = addRecent(prefs.recentLessons, { curriculumId: id, lessonId, at: new Date() });
    return { value: next, changes: { recentLessons: next } };
  });
  return json({ recents: lessonRefsDTO(recents) });
});
