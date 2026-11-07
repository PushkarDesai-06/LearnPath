"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      // Radix needs the value for aria-valuenow; without it every bar reads as
      // indeterminate to assistive tech.
      value={value}
      className={cn(
        // Hairline track: barely-there border, no fill, mint indicator.
        "relative flex h-[3px] w-full items-center overflow-x-hidden rounded-full bg-foreground/[0.06]",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full flex-1 bg-primary/90 transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
