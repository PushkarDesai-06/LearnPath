"use client"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ThemeIcon } from "@/components/icons/animated"
import { THEME_LABEL, useThemeCycle } from "@/components/useThemeCycle"

/** Cycles system, light, dark. The icon shows the chosen mode. */
export function ThemeToggle({
  shortcut,
  side,
}: {
  shortcut?: string
  side?: "top" | "right" | "bottom" | "left"
}) {
  const { theme, cycle } = useThemeCycle()
  const label = `Theme: ${THEME_LABEL[theme]}`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={cycle}
          className="group"
        >
          <ThemeIcon theme={theme} />
        </Button>
      </TooltipTrigger>
      <TooltipContent shortcut={shortcut} side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
