"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
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
import {
  SidebarDropdownMenu,
  useSidebarUi,
} from "@/components/shell/SidebarUi";
import type { RowMenuEntry } from "@/components/shell/rowMenus";
import { cn } from "@/lib/utils";

const COPIED_HOLD_MS = 700;

/**
 * The 3 dot button of a sidebar row. Revealed on row hover, focus within and
 * while open (it keeps its pressed look then), always shown on touch. The menu
 * opens below, or to the right in the icon rail, and flips when out of room.
 */
export function RowMenu({
  entries,
  label,
  className,
  onFocusMoved,
}: {
  entries: RowMenuEntry[];
  label: string;
  className?: string;
  onFocusMoved?: () => void;
}) {
  const { menuSide } = useSidebarUi();
  const handoff = useFocusHandoff();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  async function copy(href: string) {
    setCopied(await copyLink(href));
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setCopied(false);
    }, COPIED_HOLD_MS);
  }

  return (
    <SidebarDropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={label}
              className={cn(
                "absolute top-1 right-1 opacity-0 transition-opacity duration-(--dur-fast)",
                "group-hover/row:opacity-100 group-focus-within/row:opacity-100 data-[state=open]:opacity-100",
                "[@media(hover:none)]:opacity-100",
                "group-data-[rail=true]/rail:hidden",
                className,
              )}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        side={menuSide("bottom")}
        align="start"
        className="w-52"
        {...handoff.contentProps}
      >
        <EntryMenuItems
          entries={entries}
          kind="dropdown"
          copy={{ copied, onCopy: copy }}
          onFocusMoved={() => {
            handoff.markFocusMoved();
            onFocusMoved?.();
          }}
        />
      </DropdownMenuContent>
    </SidebarDropdownMenu>
  );
}
