"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFocusMode } from "@/components/shell/FocusMode";

/** Lesson header toggle: hides the sidebar and centers the reading column. */
export function FocusToggle() {
  const { focus, toggle } = useFocusMode();
  const label = focus ? "Leave focus mode" : "Focus mode";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={focus}
          onClick={toggle}
        >
          {focus ? <Minimize2 /> : <Maximize2 />}
        </Button>
      </TooltipTrigger>
      <TooltipContent shortcut="F">{label}</TooltipContent>
    </Tooltip>
  );
}
