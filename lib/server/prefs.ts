/**
 * Reads and writes of a learner's `userPrefs` document. A document is created
 * on the first write only; reads of a learner without one return defaults.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { curriculaCollection, userPrefsCollection } from "@/lib/db/collections";
import type { DashboardPrefs, LessonRefEntry, UserPrefsDoc } from "@/lib/db/models";
import { conflict, notFound } from "@/lib/http";

export const DEFAULT_DASHBOARD_PREFS: DashboardPrefs = {
  groupBy: "module",
  hideMastered: false,
  hideLocked: false,
  showSummaries: true,
};

export function defaultPrefs(userId: ObjectId, now = new Date()): UserPrefsDoc {
  return {
    _id: new ObjectId(),
    userId,
    pinnedLessons: [],
    recentLessons: [],
    dashboard: { ...DEFAULT_DASHBOARD_PREFS },
    collapsedGroups: [],
    focusLessons: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** Fill anything an older document lacks so callers never see undefined fields. */
export function withDefaults(doc: UserPrefsDoc | null, userId: ObjectId): UserPrefsDoc {
  const base = defaultPrefs(userId);
  if (!doc) return base;
  return {
    ...base,
    ...doc,
    dashboard: { ...base.dashboard, ...doc.dashboard },
    pinnedLessons: doc.pinnedLessons ?? [],
    recentLessons: doc.recentLessons ?? [],
    collapsedGroups: doc.collapsedGroups ?? [],
  };
}

export async function readPrefs(userId: ObjectId): Promise<UserPrefsDoc> {
  const prefs = await userPrefsCollection();
  return withDefaults(await prefs.findOne({ userId }).lean(), userId);
}

/**
 * Compare-and-swap on `updatedAt`, retried when another request wrote first, so
 * two tabs pinning at once both land. The callback may run again: keep it pure.
 */
export async function mutatePrefs<T>(
  userId: ObjectId,
  mutate: (prefs: UserPrefsDoc) => { value: T; changes?: Partial<UserPrefsDoc> },
): Promise<T> {
  const prefs = await userPrefsCollection();
  for (let attempt = 0; attempt < 5; attempt++) {
    const stored = await prefs.findOne({ userId }).lean();
    const current = withDefaults(stored, userId);
    const { value, changes } = mutate(current);
    if (!changes) return value;
    const now = new Date();
    if (!stored) {
      try {
        await prefs.create({ ...current, ...changes, createdAt: now, updatedAt: now });
        return value;
      } catch (error) {
        if ((error as { code?: number }).code === 11000) continue;
        throw error;
      }
    }
    const saved = await prefs.updateOne(
      { userId, updatedAt: stored.updatedAt },
      { $set: { ...changes, updatedAt: now } },
    );
    if (saved.matchedCount === 1) return value;
  }
  throw conflict("Your preferences changed while saving. Please retry.");
}

export const objectIdSchema = z.string().regex(/^[0-9a-f]{24}$/i, "Invalid id");

export const lessonRefBody = z.object({
  curriculumId: objectIdSchema,
  lessonId: z.string().min(1).max(200),
});

/** The lesson must exist in a curriculum the learner owns. */
export async function requireOwnedLesson(
  userId: ObjectId,
  curriculumId: string,
  lessonId: string,
): Promise<ObjectId> {
  const id = new ObjectId(curriculumId);
  const curricula = await curriculaCollection();
  const owned = await curricula.exists({ _id: id, userId, "modules.lessons.id": lessonId });
  if (!owned) throw notFound("Lesson not found");
  return id;
}

export function lessonRefsDTO(entries: LessonRefEntry[]) {
  return entries.map((e) => ({
    curriculumId: e.curriculumId.toHexString(),
    lessonId: e.lessonId,
    at: e.at.toISOString(),
  }));
}

export function prefsDTO(prefs: UserPrefsDoc) {
  return {
    dashboard: prefs.dashboard,
    collapsedGroups: prefs.collapsedGroups,
    focusLessons: prefs.focusLessons,
  };
}
