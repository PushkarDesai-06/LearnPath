"use client";

import { MoreHorizontal } from "lucide-react";
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
import { EntryMenuItems } from "@/components/shell/EntryMenuItems";
import type { RowMenuEntry } from "@/components/shell/rowMenus";

/** The 3 dot button for a row or panel. Pass `open` and `onOpenChange` to drive it from a key. */
export function MenuButton({
  entries,
  label,
  open,
  onOpenChange,
  className,
  tabIndex,
}: {
  entries: RowMenuEntry[];
  label: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  tabIndex?: number;
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={label}
              tabIndex={tabIndex}
              className={className}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <EntryMenuItems kind="dropdown" entries={entries} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
