import type * as React from "react"
import type { LessonStatus, ModuleStatus } from "@/lib/db/models"
import { cn } from "@/lib/utils"

export type StatusIconStatus = LessonStatus | ModuleStatus | "generating"

const LABELS: Record<StatusIconStatus, string> = {
  locked: "Locked",
  available: "Available",
  in_progress: "In progress",
  needs_review: "Needs review",
  mastered: "Mastered",
  completed: "Completed",
  generating: "Generating",
}

const RING = { cx: 7, cy: 7, r: 6, fill: "none", strokeWidth: 1.5 } as const
const PIE_RADIUS = 2.5
const PIE_CIRCUMFERENCE = 2 * Math.PI * PIE_RADIUS

type StatusIconProps = Omit<React.ComponentProps<"svg">, "children"> & {
  status: StatusIconStatus
  /** 0..1. Only used by `in_progress`, where it sets the pie fill. */
  mastery?: number
  /** Size in px. */
  size?: number
  /** Replaces the default accessible label. */
  label?: string
  /** Set false to skip the mount animations (long lists). */
  animate?: boolean
}

function clamp01(value: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

/** Monochrome status glyph. Each state is a different shape, color is `currentColor`. */
export function StatusIcon({
  status,
  mastery = 0,
  size = 14,
  label,
  animate = true,
  className,
  ...props
}: StatusIconProps) {
  const accessibleLabel = label ?? LABELS[status]
  const tone = status === "mastered" || status === "completed" ? "text-foreground" : "text-muted-foreground"

  return (
    <svg
      viewBox="0 0 14 14"
      width={size}
      height={size}
      role="img"
      aria-label={accessibleLabel}
      className={cn("shrink-0", tone, className)}
      {...props}
    >
      <title>{accessibleLabel}</title>
      <Glyph status={status} mastery={clamp01(mastery)} animate={animate} />
    </svg>
  )
}

function Glyph({
  status,
  mastery,
  animate,
}: {
  status: StatusIconStatus
  mastery: number
  animate: boolean
}) {
  switch (status) {
    case "locked":
      return <circle {...RING} stroke="currentColor" strokeDasharray="2 2.2" />
    case "available":
      return <circle {...RING} stroke="currentColor" />
    case "in_progress":
      return (
        <>
          <circle {...RING} stroke="currentColor" />
          <circle
            cx={7}
            cy={7}
            r={PIE_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={5}
            transform="rotate(-90 7 7)"
            className={animate ? "lp-fill" : undefined}
            style={{
              strokeDasharray: `${mastery * PIE_CIRCUMFERENCE} ${PIE_CIRCUMFERENCE}`,
            }}
          />
        </>
      )
    case "needs_review":
      return (
        <>
          <circle {...RING} stroke="currentColor" />
          <path
            d="M5 5.2a2.6 2.6 0 1 1-.6 2.4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
          <path
            d="M4.4 4v1.6H6"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )
    case "mastered":
    case "completed":
      return (
        <>
          <circle cx={7} cy={7} r={6} fill="currentColor" />
          <path
            d="m4.3 7.2 1.8 1.8 3.6-3.8"
            fill="none"
            stroke="var(--background)"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={animate ? "lp-check" : "lp-check-static"}
          />
        </>
      )
    case "generating":
      return (
        <>
          <circle {...RING} stroke="var(--surface-3)" />
          <path
            d="M7 1a6 6 0 0 1 6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            className="lp-arc"
          />
        </>
      )
  }
}
