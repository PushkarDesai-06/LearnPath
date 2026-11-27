"use client";

import { useSyncExternalStore } from "react";
import type { ShellLessonLink } from "@/lib/data/types";
import type { TopicOverride, TopicOverrides } from "@/lib/client/topicState";

interface Overrides {
  topics: TopicOverrides;
  pins: ShellLessonLink[] | null;
  recents: ShellLessonLink[] | null;
}

const EMPTY: Overrides = { topics: new Map(), pins: null, recents: null };

let snapshot = EMPTY;
const listeners = new Set<() => void>();

function commit(next: Overrides) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

/**
 * Optimistic state shown over the server data by the sidebar and the topics
 * page. It is cleared whenever fresh server data arrives, and per entry when an
 * action fails.
 */
export const shellOverrides = {
  /** Merges `patch` into a topic's override. A key set to undefined is removed. */
  patchTopic(id: string, patch: { [K in keyof TopicOverride]: TopicOverride[K] | undefined }) {
    const topics = new Map(snapshot.topics);
    const merged: TopicOverride = { ...topics.get(id), ...patch };
    if (merged.title === undefined) delete merged.title;
    if (merged.state === undefined) delete merged.state;
    if (Object.keys(merged).length === 0) topics.delete(id);
    else topics.set(id, merged);
    commit({ ...snapshot, topics });
  },
  setPins(pins: ShellLessonLink[] | null) {
    commit({ ...snapshot, pins });
  },
  setRecents(recents: ShellLessonLink[] | null) {
    commit({ ...snapshot, recents });
  },
  clear() {
    if (snapshot !== EMPTY) commit(EMPTY);
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useShellOverrides() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
}
