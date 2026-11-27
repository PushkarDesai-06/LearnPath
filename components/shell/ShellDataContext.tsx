"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ShellArchivedTopic,
  ShellLessonLink,
  ShellTopic,
} from "@/lib/data/types";

export interface ShellSnapshot {
  topics: ShellTopic[];
  archivedTopics: ShellArchivedTopic[];
  pins: ShellLessonLink[];
  recents: ShellLessonLink[];
  dueCardsTotal: number;
}

const EMPTY_SNAPSHOT: ShellSnapshot = {
  topics: [],
  archivedTopics: [],
  pins: [],
  recents: [],
  dueCardsTotal: 0,
};

interface ShellDataValue {
  snapshot: ShellSnapshot;
  loaded: boolean;
  publish: (snapshot: ShellSnapshot) => void;
}

const ShellDataContext = createContext<ShellDataValue>({
  snapshot: EMPTY_SNAPSHOT,
  loaded: false,
  publish: () => {},
});

/**
 * The sidebar streams its data in behind Suspense, so the palette can't read it
 * from props. The sidebar publishes the same, override-applied data here.
 */
export function ShellDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ snapshot: ShellSnapshot; loaded: boolean }>({
    snapshot: EMPTY_SNAPSHOT,
    loaded: false,
  });
  const publish = useCallback(
    (snapshot: ShellSnapshot) => setState({ snapshot, loaded: true }),
    [],
  );
  const value = useMemo(() => ({ ...state, publish }), [state, publish]);
  return (
    <ShellDataContext.Provider value={value}>
      {children}
    </ShellDataContext.Provider>
  );
}

export function useShellSnapshot() {
  const { snapshot, loaded } = useContext(ShellDataContext);
  return { ...snapshot, loaded };
}

export function usePublishShellData(snapshot: ShellSnapshot) {
  const { publish } = useContext(ShellDataContext);
  useEffect(() => {
    publish(snapshot);
  }, [publish, snapshot]);
}
