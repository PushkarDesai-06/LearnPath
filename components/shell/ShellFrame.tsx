"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  Suspense,
  type CSSProperties,
  type ReactNode,
} from "react";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { FocusModeProvider, useFocusMode } from "@/components/shell/FocusMode";
import { ShellDataProvider } from "@/components/shell/ShellDataContext";
import { ShortcutsProvider } from "@/components/shell/ShortcutsProvider";
import { TimeZoneCookie } from "@/components/shell/TimeZoneCookie";
import {
  clampSidebarWidth,
  COOKIE_MAX_AGE,
  SIDEBAR_WIDTH_COOKIE,
  SIDEBAR_WIDTH_RAIL,
} from "@/components/shell/constants";
import {
  hasOpenOverlay,
  isPlainShortcut,
  isTypingTarget,
} from "@/lib/client/keys";

interface SidebarWidthValue {
  width: number;
  resizing: boolean;
  setResizing: (resizing: boolean) => void;
  /** Live while dragging, so it only touches state. */
  preview: (width: number) => void;
  /** Persists to the cookie the layout reads. */
  commit: (width: number) => void;
}

const SidebarWidthContext = createContext<SidebarWidthValue | null>(null);

export function useSidebarWidth() {
  const value = useContext(SidebarWidthContext);
  if (!value) throw new Error("useSidebarWidth must be used inside ShellFrame");
  return value;
}

function ShellShortcuts() {
  const { toggleSidebar, isMobile } = useSidebar();
  const { isLessonRoute, active, toggle, setFocus } = useFocusMode();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const free =
          !event.defaultPrevented &&
          !event.isComposing &&
          !isTypingTarget(event.target);
        if (active && free && !hasOpenOverlay()) setFocus(false);
        return;
      }
      if (!isPlainShortcut(event)) return;
      if (event.key === "[" && !isMobile) {
        event.preventDefault();
        toggleSidebar();
      } else if (
        (event.key === "f" || event.key === "F") &&
        isLessonRoute &&
        !hasOpenOverlay()
      ) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, isLessonRoute, isMobile, setFocus, toggle, toggleSidebar]);

  return null;
}

/**
 * Client root of the shell: sidebar open state and width (both seeded from
 * cookies by the layout), the lesson focus preference, and the global shell keys.
 */
export function ShellFrame({
  defaultOpen,
  defaultWidth,
  focusLessons,
  children,
}: {
  defaultOpen: boolean;
  defaultWidth: number;
  focusLessons: boolean;
  children: ReactNode;
}) {
  const [width, setWidth] = useState(clampSidebarWidth(defaultWidth));
  const [resizing, setResizing] = useState(false);

  const preview = useCallback(
    (next: number) => setWidth(clampSidebarWidth(next)),
    [],
  );
  const commit = useCallback((next: number) => {
    const clamped = clampSidebarWidth(next);
    setWidth(clamped);
    document.cookie = `${SIDEBAR_WIDTH_COOKIE}=${clamped}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  }, []);

  const widthValue = useMemo(
    () => ({ width, resizing, setResizing, preview, commit }),
    [width, resizing, preview, commit],
  );

  return (
    <FocusModeProvider initial={focusLessons}>
      <SidebarWidthContext.Provider value={widthValue}>
        <SidebarProvider
          defaultOpen={defaultOpen}
          style={
            {
              "--sidebar-width": `${width}px`,
              "--sidebar-width-icon": `${SIDEBAR_WIDTH_RAIL}px`,
            } as CSSProperties
          }
        >
          <ShellDataProvider>
            <ShellShortcuts />
            <Suspense fallback={null}>
              <ShortcutsProvider />
            </Suspense>
            <TimeZoneCookie />
            {children}
          </ShellDataProvider>
        </SidebarProvider>
      </SidebarWidthContext.Provider>
    </FocusModeProvider>
  );
}
