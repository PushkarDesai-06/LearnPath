"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { api } from "@/lib/client/api";
import type { LessonOverride } from "@/lib/client/lessonGroups";
import type { DashboardPrefs } from "@/lib/db/models";
import type { DashboardModule } from "@/lib/data/types";

const PREFS_DEBOUNCE_MS = 400;

interface DashboardStore {
  curriculumId: string;
  prefs: DashboardPrefs;
  setPrefs: (patch: Partial<DashboardPrefs>) => void;
  pinnedCount: number;
  isPinned: (lessonId: string) => boolean;
  setPinned: (lessonId: string, pinned: boolean) => void;
  overrides: Record<string, LessonOverride>;
  patchLesson: (lessonId: string, patch: LessonOverride | null) => void;
}

const DashboardContext = createContext<DashboardStore | null>(null);

export function useDashboard() {
  const store = useContext(DashboardContext);
  if (!store) throw new Error("useDashboard must be used inside DashboardProvider");
  return store;
}

/**
 * Client state shared by the header's view options and the lesson list: the view
 * preferences (applied at once, saved debounced), the optimistic pin set and
 * optimistic lesson progress. The server data stays the source of truth: when a
 * refresh delivers new props the optimistic layers are dropped.
 */
export function DashboardProvider({
  curriculumId,
  initialPrefs,
  pinnedLessonIds,
  modules,
  children,
}: {
  curriculumId: string;
  initialPrefs: DashboardPrefs;
  pinnedLessonIds: string[];
  modules: DashboardModule[];
  children: ReactNode;
}) {
  const [prefs, setPrefsState] = useState(initialPrefs);
  const [pinned, setPinnedState] = useState(() => new Set(pinnedLessonIds));
  const [overrides, setOverrides] = useState<Record<string, LessonOverride>>({});
  const [synced, setSynced] = useState({ pinnedLessonIds, modules });

  if (synced.pinnedLessonIds !== pinnedLessonIds || synced.modules !== modules) {
    setSynced({ pinnedLessonIds, modules });
    setPinnedState(new Set(pinnedLessonIds));
    setOverrides({});
  }

  const confirmed = useRef(initialPrefs);
  const pending = useRef<Partial<DashboardPrefs>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flush = useCallback(async () => {
    const body = pending.current;
    pending.current = {};
    if (Object.keys(body).length === 0) return;
    try {
      await api("/api/me/prefs", { method: "PATCH", body: { dashboard: body } });
      confirmed.current = { ...confirmed.current, ...body };
    } catch (error) {
      setPrefsState({ ...confirmed.current, ...pending.current });
      toast.error(
        error instanceof Error ? error.message : "Could not save your view options",
      );
    }
  }, []);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      void flush();
    },
    [flush],
  );

  const setPrefs = useCallback(
    (patch: Partial<DashboardPrefs>) => {
      setPrefsState((current) => ({ ...current, ...patch }));
      pending.current = { ...pending.current, ...patch };
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), PREFS_DEBOUNCE_MS);
    },
    [flush],
  );

  const setPinned = useCallback((lessonId: string, next: boolean) => {
    setPinnedState((current) => {
      const copy = new Set(current);
      if (next) copy.add(lessonId);
      else copy.delete(lessonId);
      return copy;
    });
  }, []);

  const patchLesson = useCallback(
    (lessonId: string, patch: LessonOverride | null) => {
      setOverrides((current) => {
        if (patch) return { ...current, [lessonId]: patch };
        const rest = { ...current };
        delete rest[lessonId];
        return rest;
      });
    },
    [],
  );

  const store = useMemo<DashboardStore>(
    () => ({
      curriculumId,
      prefs,
      setPrefs,
      pinnedCount: pinned.size,
      isPinned: (lessonId) => pinned.has(lessonId),
      setPinned,
      overrides,
      patchLesson,
    }),
    [curriculumId, prefs, setPrefs, pinned, setPinned, overrides, patchLesson],
  );

  return (
    <DashboardContext.Provider value={store}>
      {children}
    </DashboardContext.Provider>
  );
}
