"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Sidebar, useSidebar } from "@/components/ui/sidebar";
import { useFocusMode } from "@/components/shell/FocusMode";
import { useSidebarWidth } from "@/components/shell/ShellFrame";
import { SidebarUiContext } from "@/components/shell/SidebarUi";
import {
  PEEK_DELAY_MS,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
} from "@/components/shell/constants";
import { cn } from "@/lib/utils";

const KEYBOARD_STEP = 8;

/**
 * Owns the sidebar's behavior shell: rail versus full layout, the hover peek
 * over the collapsed rail, the drag-to-resize edge and the focus-mode slide away.
 * The content (real or skeleton) is passed in, so both share the same geometry.
 */
export function SidebarFrame({ children }: { children: ReactNode }) {
  const { state, isMobile } = useSidebar();
  const { active: focusActive } = useFocusMode();
  const { width, resizing, setResizing, preview, commit } = useSidebarWidth();

  const collapsed = state === "collapsed" && !isMobile;
  const [peekRequested, setPeekRequested] = useState(false);
  const peek = collapsed && peekRequested;
  const rail = collapsed && !peek;

  const peekTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const holds = useRef(0);
  const pointerInside = useRef(false);

  const cancelPeekTimer = useCallback(() => {
    clearTimeout(peekTimer.current);
    peekTimer.current = undefined;
  }, []);

  useEffect(() => cancelPeekTimer, [cancelPeekTimer]);

  const [wasCollapsed, setWasCollapsed] = useState(collapsed);
  if (wasCollapsed !== collapsed) {
    setWasCollapsed(collapsed);
    if (!collapsed) setPeekRequested(false);
  }

  const startPeekTimer = () => {
    if (!collapsed || focusActive || peekTimer.current) return;
    peekTimer.current = setTimeout(() => {
      peekTimer.current = undefined;
      setPeekRequested(true);
    }, PEEK_DELAY_MS);
  };

  const holdPeek = useCallback((held: boolean) => {
    holds.current = Math.max(0, holds.current + (held ? 1 : -1));
    if (holds.current === 0 && !pointerInside.current) setPeekRequested(false);
  }, []);

  const ui = useMemo(
    () => ({
      rail,
      holdPeek,
      menuSide: (preferred: "bottom" | "top") =>
        rail ? ("right" as const) : preferred,
    }),
    [rail, holdPeek],
  );

  const onResizeDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
  };
  const onResizeMove = (event: PointerEvent<HTMLDivElement>) => {
    if (resizing) preview(event.clientX);
  };
  const onResizeUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!resizing) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setResizing(false);
    commit(event.clientX);
  };
  const onResizeKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") commit(width - KEYBOARD_STEP);
    else if (event.key === "ArrowRight") commit(width + KEYBOARD_STEP);
    else if (event.key === "Home") commit(SIDEBAR_WIDTH_MIN);
    else if (event.key === "End") commit(SIDEBAR_WIDTH_MAX);
    else return;
    event.preventDefault();
  };

  return (
    <SidebarUiContext.Provider value={ui}>
      {collapsed && !peek && !focusActive && (
        <div
          aria-hidden
          className="fixed inset-y-0 left-0 z-40 hidden w-1.5 md:block"
          onPointerEnter={startPeekTimer}
          onPointerLeave={cancelPeekTimer}
        />
      )}
      <Sidebar
        collapsible="icon"
        peek={peek}
        hidden={focusActive}
        resizing={resizing}
        inert={focusActive}
        onPointerEnter={() => {
          pointerInside.current = true;
        }}
        onPointerLeave={() => {
          pointerInside.current = false;
          cancelPeekTimer();
          if (holds.current === 0) setPeekRequested(false);
        }}
      >
        <div
          data-rail={rail}
          className="group/rail relative flex size-full min-w-0 flex-col overflow-hidden"
        >
          {children}
          {!rail && !isMobile && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              aria-valuemin={SIDEBAR_WIDTH_MIN}
              aria-valuemax={SIDEBAR_WIDTH_MAX}
              aria-valuenow={width}
              tabIndex={0}
              onPointerDown={onResizeDown}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeUp}
              onPointerCancel={onResizeUp}
              onDoubleClick={() => commit(SIDEBAR_WIDTH_DEFAULT)}
              onKeyDown={onResizeKey}
              className={cn(
                "absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize outline-none touch-none",
                "after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-transparent after:transition-colors",
                "hover:after:bg-border-strong focus-visible:after:bg-foreground",
                resizing && "after:bg-foreground",
              )}
            />
          )}
        </div>
      </Sidebar>
    </SidebarUiContext.Provider>
  );
}
