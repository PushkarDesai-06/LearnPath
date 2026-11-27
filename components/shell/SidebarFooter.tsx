"use client";

import { CircleHelp, Keyboard, MessageCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SidebarToggleIcon } from "@/components/icons/animated";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  SidebarDropdownMenu,
  useSidebarUi,
} from "@/components/shell/SidebarUi";
import { openShortcutsSheet } from "@/components/shell/events";
import { useSidebar } from "@/components/ui/sidebar";

const FEEDBACK_HREF = "mailto:?subject=LearnPath%20feedback";

export function SidebarFooter() {
  const { menuSide } = useSidebarUi();
  const { state, toggleSidebar, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <div className="flex items-center gap-0.5 border-t border-sidebar-border px-2 py-1.5 group-data-[rail=true]/rail:flex-col">
      <SidebarDropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Help and shortcuts"
              >
                <CircleHelp />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">Help</TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          side={menuSide("top")}
          align="start"
          className="w-56"
        >
          <DropdownMenuItem onSelect={openShortcutsSheet}>
            <Keyboard />
            Keyboard shortcuts
            <DropdownMenuShortcut>?</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => toast.info("No release notes yet")}>
            <Sparkles />
            What&apos;s new
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={FEEDBACK_HREF}>
              <MessageCircle />
              Send feedback
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </SidebarDropdownMenu>

      <span className="flex-1 group-data-[rail=true]/rail:hidden" />

      <ThemeToggle side={collapsed ? "right" : "top"} />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={toggleLabel}
            onClick={toggleSidebar}
            className="group max-md:hidden"
          >
            <SidebarToggleIcon collapsed={collapsed} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side={collapsed ? "right" : "top"} shortcut="[">
          {toggleLabel}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
