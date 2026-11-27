"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
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
import {
  copyLink,
  EntryMenuItems,
  useFocusHandoff,
} from "@/components/shell/EntryMenuItems";
import { useSidebarUi } from "@/components/shell/SidebarUi";
import type { RowMenuEntry } from "@/components/shell/rowMenus";
import { cn } from "@/lib/utils";

const COPIED_HOLD_MS = 700;

/**
 * 3 dot dropdown for rows, cards and page headers outside the sidebar. Pass
 * `revealOnRowHover` where the trigger sits in a `group/row`: it then shows on
 * hover, focus within and while open, and always on touch.
 */
export function EntryMenu({
  entries,
  label,
  revealOnRowHover = false,
  className,
}: {
  entries: RowMenuEntry[];
  label: string;
  revealOnRowHover?: boolean;
  className?: string;
}) {
  const handoff = useFocusHandoff();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy(href: string) {
    setCopied(await copyLink(href));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setOpen(false);
      setCopied(false);
    }, COPIED_HOLD_MS);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={label}
              className={cn(
                "relative z-10",
                revealOnRowHover &&
                  "transition-opacity duration-(--dur-fast) [@media(hover:hover)]:opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
                className,
              )}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-52" {...handoff.contentProps}>
        <EntryMenuItems
          entries={entries}
          kind="dropdown"
          copy={{ copied, onCopy: copy }}
          onFocusMoved={handoff.markFocusMoved}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Right click (or long press) menu showing the same entries as the row's 3 dot menu. */
export function EntryContextMenu({
  entries,
  children,
}: {
  entries: RowMenuEntry[];
  children: ReactNode;
}) {
  const { holdPeek } = useSidebarUi();
  const handoff = useFocusHandoff();
  const held = useRef(false);

  useEffect(
    () => () => {
      if (held.current) holdPeek(false);
    },
    [holdPeek],
  );

  return (
    <ContextMenu
      onOpenChange={(open) => {
        held.current = open;
        holdPeek(open);
      }}
    >
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52" {...handoff.contentProps}>
        <EntryMenuItems
          entries={entries}
          kind="context"
          onFocusMoved={handoff.markFocusMoved}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}
