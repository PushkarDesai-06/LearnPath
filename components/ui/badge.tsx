import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"
import type { StatusTone } from "@/lib/format"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background [a]:hover:bg-foreground/85",
        secondary:
          "bg-surface-3 text-fg-2 [a]:hover:bg-active",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border-strong text-fg-2 [a]:hover:bg-hover",
        ghost:
          "hover:bg-hover hover:text-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
        // Status badges: mono caps, hairline border, soft tinted fill. Tone color
        // comes from the data-tone attribute below.
        status:
          "font-mono uppercase tracking-[0.08em] text-[10px] leading-none px-2 py-1 h-auto rounded-full border border-current/25",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const TONE_CLASSES: Record<StatusTone, string> = {
  mastered: "text-tone-mastered bg-active",
  progress: "text-tone-progress bg-hover",
  review: "text-tone-review bg-hover",
  locked: "text-tone-locked bg-hover",
  generating: "text-tone-generating bg-hover",
  neutral: "text-muted-foreground bg-hover",
}

function Badge({
  className,
  variant = "default",
  tone,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean
    tone?: StatusTone
  }) {
  const Comp = asChild ? Slot.Root : "span"
  const toneClass =
    variant === "status" && tone ? TONE_CLASSES[tone] : undefined

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-tone={tone}
      className={cn(badgeVariants({ variant }), toneClass, className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
