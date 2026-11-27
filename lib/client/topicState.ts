export const TITLE_MAX = 120;

export type TopicState = "active" | "archived" | "deleted";

export interface TopicOverride {
  title?: string;
  state?: TopicState;
}

export type TopicOverrides = ReadonlyMap<string, TopicOverride>;

/** Trimmed title, or null when it is empty or longer than the API accepts. */
export function normalizeTitle(raw: string): string | null {
  const title = raw.trim();
  return title.length >= 1 && title.length <= TITLE_MAX ? title : null;
}

/** Progress means mastery above zero or at least one mastered lesson. */
export function topicHasProgress(topic: {
  mastery: number;
  lessonsMastered: number;
}) {
  return topic.mastery > 0 || topic.lessonsMastered > 0;
}

export function titleMatches(typed: string, title: string) {
  return typed.trim() === title.trim();
}

/**
 * Applies optimistic topic changes over server lists. Renames show everywhere,
 * archived topics leave the active list and join the archived one, restored and
 * deleted topics leave the archived list, deleted ones leave the active list too.
 */
export function applyTopicOverrides<
  A extends { id: string; title: string },
  R extends { id: string; title: string },
>(
  active: A[],
  archived: R[],
  overrides: TopicOverrides,
  toArchived: (topic: A) => R,
): { active: A[]; archived: R[] } {
  const retitled = <T extends { id: string; title: string }>(item: T): T => {
    const title = overrides.get(item.id)?.title;
    return title === undefined ? item : { ...item, title };
  };
  const stateOf = (id: string) => overrides.get(id)?.state;

  const nextActive = active
    .filter((topic) => {
      const state = stateOf(topic.id);
      return state !== "archived" && state !== "deleted";
    })
    .map(retitled);

  const justArchived = active
    .filter((topic) => stateOf(topic.id) === "archived")
    .map((topic) => retitled(toArchived(topic)));

  const keptArchived = archived
    .filter((topic) => {
      const state = stateOf(topic.id);
      return state !== "active" && state !== "deleted";
    })
    .map(retitled);

  return { active: nextActive, archived: [...justArchived, ...keptArchived] };
}

/** Moves `id` next to `targetId`, before or after it. Unknown ids leave the list as is. */
export function moveBeside(
  ids: string[],
  id: string,
  targetId: string,
  placement: "before" | "after",
): string[] {
  if (id === targetId || !ids.includes(id) || !ids.includes(targetId)) {
    return ids;
  }
  const rest = ids.filter((current) => current !== id);
  const at = rest.indexOf(targetId) + (placement === "after" ? 1 : 0);
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

/** Moves `id` up (-1) or down (1) by one place, stopping at the ends. */
export function shiftId(ids: string[], id: string, delta: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function sameOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}
