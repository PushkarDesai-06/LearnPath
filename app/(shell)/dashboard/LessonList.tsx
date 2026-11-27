"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChevronIcon } from "@/components/icons/animated";
import { ResetLessonDialog } from "@/components/shell/ResetLessonDialog";
import { StatusIcon } from "@/components/StatusIcon";
import { lessonRowMenu, moduleRowMenu } from "@/components/shell/rowMenus";
import {
  useLessonActions,
  type ActionLesson,
} from "@/components/shell/useLessonActions";
import { useIsMobile } from "@/hooks/use-mobile";
import { hasOpenOverlay, isPlainShortcut } from "@/lib/client/keys";
import { useNavigate } from "@/lib/client/progress";
import {
  buildGroups,
  type ListGroup,
  type ListLesson,
} from "@/lib/client/lessonGroups";
import type { DashboardModule } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { useDashboard } from "./DashboardProvider";
import { MenuButton } from "./LessonMenuButton";
import { LessonPeek } from "./LessonPeek";
import { LessonRow, lessonRowDomId } from "./LessonRow";

const HIGHLIGHT_MS = 1600;

const REVEAL =
  "opacity-0 transition-opacity duration-(--dur-fast) group-hover/head:opacity-100 group-focus-within/head:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100";

function useHashHighlight(
  groups: ListGroup[],
  expand: (key: string) => void,
) {
  const [highlight, setHighlight] = useState<string | null>(null);
  const latest = useRef(groups);
  useEffect(() => {
    latest.current = groups;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const apply = () => {
      const anchor = window.location.hash.slice(1);
      const group = latest.current.find((g) => g.anchorId === anchor);
      if (!group) return;
      expand(group.key);
      setHighlight(group.key);
      requestAnimationFrame(() =>
        document.getElementById(anchor)?.scrollIntoView({ block: "start" }),
      );
      clearTimeout(timer);
      timer = setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
    };

    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest("a[href*='#mod-']");
      if (link) setTimeout(apply, 0);
    };

    apply();
    window.addEventListener("hashchange", apply);
    document.addEventListener("click", onClick, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("hashchange", apply);
      document.removeEventListener("click", onClick, true);
    };
  }, [expand]);

  return highlight;
}

export function LessonList({
  modules,
  timeZone,
}: {
  modules: DashboardModule[];
  timeZone: string;
}) {
  const store = useDashboard();
  const { curriculumId, prefs, overrides, isPinned, setPrefs } = store;
  const navigate = useNavigate();
  const actions = useLessonActions(store);
  const mobile = useIsMobile();

  const groups = useMemo(
    () => buildGroups(modules, prefs, overrides),
    [modules, prefs, overrides],
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [peekOpen, setPeekOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<ActionLesson | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const toggleGroup = useCallback((key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);
  const expandGroup = useCallback((key: string) => {
    setCollapsed((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }, []);
  const highlight = useHashHighlight(groups, expandGroup);

  const navRows = useMemo(
    () =>
      groups
        .filter((group) => !collapsed.has(group.key))
        .flatMap((group) => group.lessons.filter((lesson) => !lesson.locked)),
    [groups, collapsed],
  );
  const activeLesson = navRows.find((lesson) => lesson.id === selectedId) ?? null;
  const activeId = activeLesson?.id ?? null;
  const tabbableId = activeId ?? navRows[0]?.id ?? null;

  const focusRow = useCallback((lessonId: string) => {
    requestAnimationFrame(() => {
      const row = document.getElementById(lessonRowDomId(lessonId));
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: "nearest" });
    });
  }, []);

  const togglePin = (lesson: ActionLesson) =>
    void (isPinned(lesson.id) ? actions.unpin(lesson) : actions.pin(lesson));

  const openLesson = (lessonId: string) => navigate.push(`/learn/${lessonId}`);

  const closePeek = () => {
    setPeekOpen(false);
    if (activeId) focusRow(activeId);
  };

  const select = (lessonId: string) => setSelectedId(lessonId);
  const peek = (lessonId: string) => {
    setSelectedId(lessonId);
    setPeekOpen(true);
  };
  const changeMenu = (lessonId: string, open: boolean) =>
    setMenuId((current) =>
      open ? lessonId : current === lessonId ? null : current,
    );

  const entriesFor = (lesson: ListLesson, withPeek: boolean) =>
    lessonRowMenu(
      { curriculumId, lessonId: lesson.id, pinned: isPinned(lesson.id) },
      {
        peek: withPeek ? () => peek(lesson.id) : undefined,
        togglePin: () => togglePin(lesson),
        makeFlashcards: () => void actions.makeFlashcards(lesson),
        markForReview: () =>
          void actions.markForReview(lesson, lesson.masteryScore),
        requestReset: () => setResetTarget(lesson),
      },
    );

  const keys = useRef({
    navRows,
    activeId,
    peekOpen,
    togglePin,
    openLesson,
    closePeek,
    focusRow,
  });
  useEffect(() => {
    keys.current = {
      navRows,
      activeId,
      peekOpen,
      togglePin,
      openLesson,
      closePeek,
      focusRow,
    };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPlainShortcut(event) || hasOpenOverlay()) return;
      const { navRows, activeId, peekOpen } = keys.current;
      const target = event.target as HTMLElement;
      const inGrid = gridRef.current?.contains(target) ?? false;
      const onControl = target.closest("button, a, [role='menuitem']") !== null;

      const move = (direction: 1 | -1) => {
        if (navRows.length === 0) return;
        const index = navRows.findIndex((lesson) => lesson.id === activeId);
        const next =
          index < 0
            ? direction === 1
              ? 0
              : navRows.length - 1
            : Math.min(navRows.length - 1, Math.max(0, index + direction));
        const lessonId = navRows[next].id;
        setSelectedId(lessonId);
        keys.current.focusRow(lessonId);
      };

      const active = navRows.find((lesson) => lesson.id === activeId);

      switch (event.key) {
        case "j":
        case "J":
          event.preventDefault();
          move(1);
          break;
        case "k":
        case "K":
          event.preventDefault();
          move(-1);
          break;
        case "ArrowDown":
        case "ArrowUp":
          if (!inGrid || onControl) return;
          event.preventDefault();
          move(event.key === "ArrowDown" ? 1 : -1);
          break;
        case "Enter":
          if (!active || onControl) return;
          event.preventDefault();
          keys.current.openLesson(active.id);
          break;
        case " ": {
          if (onControl) return;
          event.preventDefault();
          if (!active) {
            if (navRows.length === 0) return;
            setSelectedId(navRows[0].id);
            setPeekOpen(true);
            keys.current.focusRow(navRows[0].id);
            return;
          }
          if (peekOpen) keys.current.closePeek();
          else setPeekOpen(true);
          break;
        }
        case "p":
        case "P":
          if (!active) return;
          event.preventDefault();
          keys.current.togglePin(active);
          break;
        case ".":
          if (!active) return;
          event.preventDefault();
          setMenuId(active.id);
          break;
        case "Escape":
          if (peekOpen) {
            event.preventDefault();
            keys.current.closePeek();
          } else if (activeId) {
            event.preventDefault();
            setSelectedId(null);
            if (inGrid) (target as HTMLElement).blur();
          }
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const showModule = prefs.groupBy === "status";

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[10px] px-4 py-10 text-center shadow-[inset_0_0_0_1px_var(--border)]">
        <Layers className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Every lesson is hidden by your view options.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setPrefs({ hideMastered: false, hideLocked: false })}
        >
          Show all lessons
        </Button>
      </div>
    );
  }

  return (
    <>
      <div
        ref={gridRef}
        role="grid"
        aria-label="Lessons"
        className="overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_var(--border)]"
      >
        {groups.map((group, groupIndex) => {
          const open = !collapsed.has(group.key);
          const toggle = () => toggleGroup(group.key);
          const menuEntries =
            group.moduleId === null
              ? []
              : moduleRowMenu(
                  { curriculumId, moduleId: group.moduleId, expanded: open },
                  toggle,
                );

          return (
            <div
              key={group.key}
              id={group.anchorId}
              role="rowgroup"
              className={cn("scroll-mt-14", groupIndex > 0 && "border-t border-border")}
            >
              <div
                role="row"
                aria-expanded={open}
                className={cn(
                  "group/head flex min-h-[34px] items-center bg-surface-2 pr-2 pl-3 text-fg-2 transition-colors duration-(--dur-slow)",
                  highlight === group.key && "bg-active",
                )}
              >
                <div role="gridcell" className="flex min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={toggle}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1.5 text-left font-medium outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                  >
                    <ChevronIcon
                      open={open}
                      className="size-3.5 text-faint"
                    />
                    <StatusIcon
                      status={group.status}
                      mastery={group.mastery}
                      animate={false}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-[13px]">{group.title}</span>
                        <span className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">
                          {group.kind === "module"
                            ? `${group.mastered}/${group.total}`
                            : group.total}
                        </span>
                      </span>
                      {group.summary && (
                        <span className="truncate text-xs font-normal text-muted-foreground">
                          {group.summary}
                        </span>
                      )}
                    </span>
                  </button>
                </div>
                <div role="gridcell" className="ml-2 shrink-0">
                  {menuEntries.length > 0 && (
                    <MenuButton
                      entries={menuEntries}
                      label="Module actions"
                      className={REVEAL}
                    />
                  )}
                </div>
              </div>
              {open &&
                group.lessons.map((lesson) => (
                  <LessonRow
                    key={lesson.id}
                    lesson={lesson}
                    showModule={showModule}
                    selected={lesson.id === activeId}
                    tabbable={lesson.id === tabbableId}
                    pinned={isPinned(lesson.id)}
                    menuOpen={menuId === lesson.id}
                    entries={entriesFor(lesson, true)}
                    onSelect={select}
                    onPeek={peek}
                    onOpen={openLesson}
                    onTogglePin={togglePin}
                    onMenuOpenChange={changeMenu}
                  />
                ))}
            </div>
          );
        })}
      </div>

      <LessonPeek
        lesson={activeLesson}
        open={peekOpen && activeLesson !== null}
        mobile={mobile}
        curriculumId={curriculumId}
        timeZone={timeZone}
        entries={activeLesson ? entriesFor(activeLesson, false) : []}
        onClose={closePeek}
      />

      <ResetLessonDialog
        lesson={resetTarget}
        onCancel={() => setResetTarget(null)}
        onConfirm={(lesson) => {
          setResetTarget(null);
          void actions.resetProgress(lesson);
        }}
      />
    </>
  );
}
