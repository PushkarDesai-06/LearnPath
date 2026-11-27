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
import Link from "next/link";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PinIcon } from "@/components/icons/animated";
import { EntryMenuItems } from "@/components/shell/EntryMenuItems";
import { FocusToggle } from "@/components/shell/FocusToggle";
import { ResetLessonDialog } from "@/components/shell/ResetLessonDialog";
import { lessonRowMenu } from "@/components/shell/rowMenus";
import { useLessonActions } from "@/components/shell/useLessonActions";
import { hasOpenOverlay, isPlainShortcut } from "@/lib/client/keys";
import { cn } from "@/lib/utils";

export interface LessonNeighbor {
  id: string;
  title: string;
  locked: boolean;
}

interface LessonControlsValue {
  pinned: boolean;
  togglePin: () => void;
  menuEntries: ReturnType<typeof lessonRowMenu>;
}

const LessonControlsContext = createContext<LessonControlsValue | null>(null);

function useLessonControls() {
  const value = useContext(LessonControlsContext);
  if (!value) throw new Error("Lesson controls must sit inside LessonControlsProvider");
  return value;
}

/**
 * Shared state for the lesson header: the pin toggle, its P key and the 3 dot
 * menu all act on one pinned value, and reset confirms in a dialog rendered here
 * (outside the menu) so it survives the menu closing.
 */
export function LessonControlsProvider({
  curriculumId,
  lessonId,
  title,
  masteryScore,
  initialPinned,
  children,
}: {
  curriculumId: string;
  lessonId: string;
  title: string;
  masteryScore: number;
  initialPinned: boolean;
  children: ReactNode;
}) {
  const [pinned, setPinned] = useState(initialPinned);
  const [resetting, setResetting] = useState(false);
  const lesson = useMemo(() => ({ id: lessonId, title }), [lessonId, title]);

  const actions = useLessonActions({
    curriculumId,
    setPinned: (_, next) => setPinned(next),
    patchLesson: () => {},
  });

  const togglePin = useCallback(() => {
    void (pinned ? actions.unpin(lesson) : actions.pin(lesson));
  }, [actions, lesson, pinned]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "p" && event.key !== "P") return;
      if (!isPlainShortcut(event) || hasOpenOverlay()) return;
      event.preventDefault();
      togglePin();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePin]);

  const menuEntries = useMemo(
    () =>
      lessonRowMenu(
        { curriculumId, lessonId, pinned },
        {
          togglePin,
          makeFlashcards: () => void actions.makeFlashcards(lesson),
          markForReview: () => void actions.markForReview(lesson, masteryScore),
          requestReset: () => setResetting(true),
        },
      ).filter(
        (entry) =>
          !(entry.type === "link" && (entry.id === "open" || entry.id === "focus")),
      ),
    [actions, curriculumId, lesson, lessonId, masteryScore, pinned, togglePin],
  );

  const value = useMemo(
    () => ({ pinned, togglePin, menuEntries }),
    [pinned, togglePin, menuEntries],
  );

  return (
    <LessonControlsContext.Provider value={value}>
      {children}
      <ResetLessonDialog
        lesson={resetting ? lesson : null}
        onCancel={() => setResetting(false)}
        onConfirm={(target) => {
          setResetting(false);
          void actions.resetProgress(target);
        }}
      />
    </LessonControlsContext.Provider>
  );
}

function NeighborButton({
  neighbor,
  direction,
}: {
  neighbor: LessonNeighbor | null;
  direction: "previous" | "next";
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
  const prefix = direction === "previous" ? "Previous" : "Next";
  const enabled = neighbor !== null && !neighbor.locked;
  const label = !neighbor
    ? `No ${direction} lesson`
    : neighbor.locked
      ? `${prefix}: ${neighbor.title} (locked)`
      : `${prefix}: ${neighbor.title}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {enabled ? (
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/learn/${neighbor.id}`} aria-label={label}>
              <Icon />
            </Link>
          </Button>
        ) : (
          <span className="inline-flex">
            <Button variant="ghost" size="icon" disabled aria-label={label}>
              <Icon />
            </Button>
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function LessonHeaderActions({
  previous,
  next,
}: {
  previous: LessonNeighbor | null;
  next: LessonNeighbor | null;
}) {
  const { pinned, togglePin } = useLessonControls();

  return (
    <>
      <NeighborButton neighbor={previous} direction="previous" />
      <NeighborButton neighbor={next} direction="next" />
      <FocusToggle />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={pinned ? "Unpin lesson" : "Pin lesson"}
            aria-pressed={pinned}
            onClick={togglePin}
            className={cn(pinned && "text-foreground")}
          >
            <PinIcon className={cn(pinned && "fill-current")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent shortcut="P">{pinned ? "Unpin" : "Pin"}</TooltipContent>
      </Tooltip>
    </>
  );
}

export function LessonMenu() {
  const { menuEntries } = useLessonControls();

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Lesson actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Lesson actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-52">
        <EntryMenuItems entries={menuEntries} kind="dropdown" />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
