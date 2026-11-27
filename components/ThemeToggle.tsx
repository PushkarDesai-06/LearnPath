"use client"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { SunMoonIcon } from "@/components/icons/animated"
import { THEME_LABEL, useThemeCycle } from "@/components/useThemeCycle"

/** Cycles system, light, dark. The icon follows the resolved theme. */
export function ThemeToggle({ shortcut }: { shortcut?: string }) {
  const { theme, isDark, cycle } = useThemeCycle()
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
          <SunMoonIcon dark={isDark} />
        </Button>
      </TooltipTrigger>
      <TooltipContent shortcut={shortcut}>{label}</TooltipContent>
    </Tooltip>
  )
}
