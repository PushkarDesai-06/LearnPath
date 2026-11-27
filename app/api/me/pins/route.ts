/** Pin a lesson (POST) or reorder the pins (PATCH). Pins sync across devices. */
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { MAX_PINS, addPin, reorderPins } from "@/lib/domain/prefs";
import { conflict, handler, json, readJson } from "@/lib/http";
import {
  lessonRefBody,
  lessonRefsDTO,
  mutatePrefs,
  requireOwnedLesson,
} from "@/lib/server/prefs";

const Reorder = z.object({ order: z.array(z.string().min(1).max(200)).max(MAX_PINS) });

export const POST = handler(async (request) => {
  const user = await requireUser();
  const { curriculumId, lessonId } = await readJson(request, lessonRefBody);
  const id = await requireOwnedLesson(user._id, curriculumId, lessonId);

  const pins = await mutatePrefs(user._id, (prefs) => {
    const added = addPin(prefs.pinnedLessons, { curriculumId: id, lessonId, at: new Date() });
    if (!added.ok) throw conflict(`You can pin up to ${MAX_PINS} lessons. Unpin one first.`);
    return { value: added.pins, changes: { pinnedLessons: added.pins } };
  });
  return json({ pins: lessonRefsDTO(pins) });
});

export const PATCH = handler(async (request) => {
  const user = await requireUser();
  const { order } = await readJson(request, Reorder);
  const pins = await mutatePrefs(user._id, (prefs) => {
    const reordered = reorderPins(prefs.pinnedLessons, order);
    return { value: reordered, changes: { pinnedLessons: reordered } };
  });
  return json({ pins: lessonRefsDTO(pins) });
});

