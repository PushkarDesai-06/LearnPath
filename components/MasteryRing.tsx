import type * as React from "react"
import { cn } from "@/lib/utils"

type MasteryRingProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** 0..1 */
  value: number
  /** 14 to 32 px. */
  size?: number
  /** Show the percentage beside the ring, counting up on first view. */
  showLabel?: boolean
  /** Accessible name, defaults to "Mastery N%". */
  label?: string
}

const RADIUS = 10
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Ring whose fill animates to `value`, with an optional count-up percentage. */
export function MasteryRing({
  value,
  size = 20,
  showLabel = false,
  label,
  className,
  ...props
}: MasteryRingProps) {
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
  const percent = Math.round(clamped * 100)
  const px = Math.min(32, Math.max(14, size))
  const strokeWidth = px <= 18 ? 3.4 : 3

  return (
    <span
      role="img"
      aria-label={label ?? `Mastery ${percent}%`}
      className={cn("inline-flex items-center gap-1.5 text-foreground", className)}
      {...props}
    >
      <svg viewBox="0 0 24 24" width={px} height={px} className="shrink-0" aria-hidden>
        <circle
          cx={12}
          cy={12}
          r={RADIUS}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={12}
          cy={12}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          transform="rotate(-90 12 12)"
          className="lp-fill"
          style={{
            strokeDasharray: `${clamped * CIRCUMFERENCE} ${CIRCUMFERENCE}`,
          }}
        />
      </svg>
      {showLabel ? (
        <span
          aria-hidden
          className="text-[11px] font-medium tabular-nums text-muted-foreground"
        >
          <span className="lp-count" style={{ "--lp-n": percent } as React.CSSProperties} />%
        </span>
      ) : null}
    </span>
  )
}
