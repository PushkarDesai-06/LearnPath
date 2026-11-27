"use client";

import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PinIcon } from "@/components/icons/animated";
import { EntryMenuItems } from "@/components/shell/EntryMenuItems";
import { StatusIcon } from "@/components/StatusIcon";
import type { RowMenuEntry } from "@/components/shell/rowMenus";
import type { ListLesson } from "@/lib/client/lessonGroups";
import { cn } from "@/lib/utils";
import { MenuButton } from "./LessonMenuButton";

export const LOCKED_HINT =
  "Locked until you finish one of the open modules. Two unfinished modules stay open at a time.";

export function lessonRowDomId(lessonId: string) {
  return `lesson-row-${lessonId}`;
}

const REVEAL =
  "opacity-0 transition-opacity duration-(--dur-fast) group-hover/row:opacity-100 group-focus-within/row:opacity-100 group-data-[selected=true]/row:opacity-100 has-data-[state=open]:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100";

interface LessonRowProps {
  lesson: ListLesson;
  showModule: boolean;
  selected: boolean;
  tabbable: boolean;
  pinned: boolean;
  menuOpen: boolean;
  entries: RowMenuEntry[];
  onSelect: (lessonId: string) => void;
  onPeek: (lessonId: string) => void;
  onOpen: (lessonId: string) => void;
  onTogglePin: (lesson: ListLesson) => void;
  onMenuOpenChange: (lessonId: string, open: boolean) => void;
}

export function LessonRow({
  lesson,
  showModule,
  selected,
  tabbable,
  pinned,
  menuOpen,
  entries,
  onSelect,
  onPeek,
  onOpen,
  onTogglePin,
  onMenuOpenChange,
}: LessonRowProps) {
  const percent = Math.round(lesson.masteryScore * 100);

  if (lesson.locked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            role="row"
            aria-disabled="true"
            className="flex h-9 items-center border-t border-border pr-3 pl-8 text-faint"
          >
            <div role="gridcell" className="flex min-w-0 flex-1 items-center gap-2.5">
              <StatusIcon status="locked" animate={false} />
              <span className="min-w-0 flex-1 truncate text-[13px]">{lesson.title}</span>
              <span className="text-xs tabular-nums">~{lesson.estMinutes}m</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>{LOCKED_HINT}</TooltipContent>
      </Tooltip>
    );
  }

  const tab = tabbable ? 0 : -1;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          id={lessonRowDomId(lesson.id)}
          role="row"
          aria-selected={selected}
          tabIndex={tab}
          data-selected={selected}
          className={cn(
            "group/row relative flex h-9 scroll-mt-14 scroll-mb-6 cursor-pointer items-center border-t border-border pr-2 pl-8 text-fg-2 outline-none transition-colors duration-(--dur-fast)",
            "hover:bg-hover hover:text-foreground focus-visible:bg-hover focus-visible:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground",
            "data-[selected=true]:bg-hover data-[selected=true]:text-foreground",
            "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-foreground before:opacity-0 data-[selected=true]:before:opacity-100",
          )}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("button")) return;
            onSelect(lesson.id);
            onPeek(lesson.id);
          }}
          onDoubleClick={(event) => {
            if ((event.target as HTMLElement).closest("button")) return;
            onOpen(lesson.id);
          }}
          onContextMenu={() => onSelect(lesson.id)}
        >
          <div role="gridcell" className="flex min-w-0 flex-1 items-center gap-2.5">
            <StatusIcon
              status={lesson.displayStatus}
              mastery={lesson.masteryScore}
              animate={false}
            />
            <span className="min-w-0 flex-1 truncate text-[13px]">{lesson.title}</span>
            <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
              {showModule && (
                <span className="hidden max-w-40 truncate lg:inline">
                  {lesson.moduleTitle}
                </span>
              )}
              <span className="hidden w-20 capitalize sm:inline">
                {lesson.difficultyLevel}
              </span>
              <span className="w-8 text-right tabular-nums">
                ~{lesson.estMinutes}m
              </span>
              <span
                aria-hidden
                className="hidden h-1 w-11 overflow-hidden rounded-full bg-surface-3 sm:block"
              >
                <span
                  className="block h-full origin-left rounded-full bg-fg-2 transition-transform duration-(--dur-slow) ease-(--ease-out)"
                  style={{ transform: `scaleX(${lesson.masteryScore})` }}
                />
              </span>
              <span className="sr-only">Mastery {percent}%</span>
            </span>
          </div>
          <div role="gridcell" className="ml-2 flex shrink-0 items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  tabIndex={tab}
                  aria-label={pinned ? "Unpin lesson" : "Pin lesson"}
                  aria-pressed={pinned}
                  className={cn("group", pinned ? "text-foreground opacity-100" : REVEAL)}
                  onClick={() => onTogglePin(lesson)}
                >
                  <PinIcon className={cn("size-3.5", pinned && "fill-current")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent shortcut="P">{pinned ? "Unpin" : "Pin"}</TooltipContent>
            </Tooltip>
            <MenuButton
              entries={entries}
              label="Lesson actions"
              open={menuOpen}
              onOpenChange={(open) => onMenuOpenChange(lesson.id, open)}
              tabIndex={tab}
              className={REVEAL}
            />
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <EntryMenuItems kind="context" entries={entries} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
