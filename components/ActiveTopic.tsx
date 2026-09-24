"use client";

/**
 * Lets a route announce which topic it belongs to when the URL can't say.
 *
 * Topic-scoped pages carry `?id=`, so `TopicSwitcher` reads the active topic
 * straight off the URL. A lesson doesn't: `/learn/<lessonId>` only identifies
 * the lesson, and the curriculum it belongs to is known solely to the server
 * render. The topbar lives in the root layout, which does NOT re-render on
 * client navigation, so it can't be told server-side either.
 *
 * So the page announces it from the client instead: `<ActiveTopicMarker>` sits
 * in the page and writes the id into a context the topbar reads. The marker
 * clears on unmount, so navigating off a lesson drops the selection.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const ActiveTopicContext = createContext<{
  id: string | null;
  setId: (id: string | null) => void;
}>({ id: null, setId: () => {} });

export function ActiveTopicProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const value = useMemo(() => ({ id, setId }), [id]);
  return (
    <ActiveTopicContext.Provider value={value}>
      {children}
    </ActiveTopicContext.Provider>
  );
}

/** The announced topic, or null on routes that announce none. */
export function useActiveTopic() {
  return useContext(ActiveTopicContext).id;
}

/**
 * Renders nothing — it only publishes `curriculumId` to the topbar for as long
 * as the page is mounted.
 */
export function ActiveTopicMarker({ curriculumId }: { curriculumId: string }) {
  const { setId } = useContext(ActiveTopicContext);
  useEffect(() => {
    setId(curriculumId);
    return () => setId(null);
  }, [curriculumId, setId]);
  return null;
}
