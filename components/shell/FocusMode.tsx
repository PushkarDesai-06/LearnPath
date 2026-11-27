"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client/api";

interface FocusModeValue {
  /** The learner's saved preference. */
  focus: boolean;
  /** True when focus is on and the current route is a lesson, the only place it applies. */
  active: boolean;
  isLessonRoute: boolean;
  setFocus: (next: boolean) => void;
  toggle: () => void;
}

const FocusModeContext = createContext<FocusModeValue>({
  focus: false,
  active: false,
  isLessonRoute: false,
  setFocus: () => {},
  toggle: () => {},
});

export function FocusModeProvider({
  initial,
  children,
}: {
  initial: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [focus, setFocusState] = useState(initial);
  const isLessonRoute = pathname.startsWith("/learn/");

  const setFocus = useCallback((next: boolean) => {
    setFocusState(next);
    api("/api/me/prefs", {
      method: "PATCH",
      body: { focusLessons: next },
    }).catch(() => {
      setFocusState(!next);
      toast.error("Could not save focus mode");
    });
  }, []);

  const toggle = useCallback(() => setFocus(!focus), [focus, setFocus]);

  const value = useMemo(
    () => ({
      focus,
      active: focus && isLessonRoute,
      isLessonRoute,
      setFocus,
      toggle,
    }),
    [focus, isLessonRoute, setFocus, toggle],
  );

  return (
    <FocusModeContext.Provider value={value}>
      {children}
    </FocusModeContext.Provider>
  );
}

export function useFocusMode() {
  return useContext(FocusModeContext);
}
