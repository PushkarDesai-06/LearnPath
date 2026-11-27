"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client/api";

const PERSIST_DEBOUNCE_MS = 500;
const OPEN_PREFIX = "open:";

export type GroupId =
  "group:pinned" | "group:recent" | "group:topics" | "group:archived";
const DEFAULT_CLOSED: ReadonlySet<string> = new Set<GroupId>([
  "group:archived",
]);

/**
 * Expand and collapse state of the sidebar, synced through `collapsedGroups`.
 *
 * Stored ids: `group:<name>` collapses a group that is open by default, and
 * `open:<id>` expands something that is closed by default (`open:group:archived`,
 * `open:topic:<topicId>`). The active topic is open by default; collapsing it
 * lasts until the active topic changes.
 */
export function useSidebarGroups(
  initial: string[],
  activeTopicId: string | null,
) {
  const [stored, setStored] = useState<ReadonlySet<string>>(
    () => new Set(initial),
  );
  const latest = useRef(stored);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [closedActive, setClosedActive] = useState<{
    topicId: string | null;
    closed: boolean;
  }>({
    topicId: null,
    closed: false,
  });

  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = useCallback((change: (next: Set<string>) => void) => {
    const next = new Set(latest.current);
    change(next);
    latest.current = next;
    setStored(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api("/api/me/prefs", {
        method: "PATCH",
        body: { collapsedGroups: [...latest.current] },
      }).catch(() => toast.error("Could not save the sidebar layout"));
    }, PERSIST_DEBOUNCE_MS);
  }, []);

  const isGroupOpen = useCallback(
    (id: GroupId) =>
      DEFAULT_CLOSED.has(id)
        ? stored.has(`${OPEN_PREFIX}${id}`)
        : !stored.has(id),
    [stored],
  );

  const toggleGroup = useCallback(
    (id: GroupId) =>
      commit((next) => {
        const key = DEFAULT_CLOSED.has(id) ? `${OPEN_PREFIX}${id}` : id;
        if (!next.delete(key)) next.add(key);
      }),
    [commit],
  );

  const sessionClosed =
    closedActive.topicId === activeTopicId && closedActive.closed;

  const isTopicOpen = useCallback(
    (topicId: string) =>
      stored.has(`${OPEN_PREFIX}topic:${topicId}`) ||
      (topicId === activeTopicId && !sessionClosed),
    [stored, activeTopicId, sessionClosed],
  );

  const toggleTopic = useCallback(
    (topicId: string) => {
      const open = isTopicOpen(topicId);
      if (topicId === activeTopicId) setClosedActive({ topicId, closed: open });
      commit((next) => {
        const key = `${OPEN_PREFIX}topic:${topicId}`;
        if (open) next.delete(key);
        else next.add(key);
      });
    },
    [activeTopicId, commit, isTopicOpen],
  );

  return { isGroupOpen, toggleGroup, isTopicOpen, toggleTopic };
}
