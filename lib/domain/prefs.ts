/**
 * Pin and recent list operations. Pure: every function returns a new list.
 * A lesson id is the identity of an entry (lesson ids are unique per learner).
 */
export const MAX_PINS = 10;
export const MAX_RECENTS = 6;

interface LessonEntry {
  lessonId: string;
}

export type PinResult<T> = { ok: true; pins: T[] } | { ok: false; reason: "full" };

/** Append to the end. Pinning an already pinned lesson changes nothing. */
export function addPin<T extends LessonEntry>(
  pins: T[],
  entry: T,
  max = MAX_PINS,
): PinResult<T> {
  if (pins.some((p) => p.lessonId === entry.lessonId)) return { ok: true, pins };
  if (pins.length >= max) return { ok: false, reason: "full" };
  return { ok: true, pins: [...pins, entry] };
}

export function removeEntry<T extends LessonEntry>(list: T[], lessonId: string): T[] {
  return list.filter((e) => e.lessonId !== lessonId);
}

/**
 * Put pins in the order given. Ids that are not pinned are ignored, and pins
 * the order leaves out keep their relative order at the end, so a stale client
 * can never drop a pin by reordering.
 */
export function reorderPins<T extends LessonEntry>(pins: T[], order: string[]): T[] {
  const byId = new Map(pins.map((p) => [p.lessonId, p]));
  const placed = new Set<string>();
  const ordered: T[] = [];
  for (const id of order) {
    const pin = byId.get(id);
    if (!pin || placed.has(id)) continue;
    placed.add(id);
    ordered.push(pin);
  }
  return [...ordered, ...pins.filter((p) => !placed.has(p.lessonId))];
}

/** Newest first: a repeat visit moves the lesson to the front instead of duplicating it. */
export function addRecent<T extends LessonEntry>(
  recents: T[],
  entry: T,
  max = MAX_RECENTS,
): T[] {
  return [entry, ...removeEntry(recents, entry.lessonId)].slice(0, max);
}
