import { cn } from "@/lib/utils"
import { IconSvg, box, move, type AnimatedIconProps } from "./base"

/** Rotates a quarter turn when an ancestor with `group` is hovered. */
export function PlusIcon({ className, ...props }: AnimatedIconProps) {
  return (
    <IconSvg className={cn(move, "group-hover:rotate-90", className)} {...props}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </IconSvg>
  )
}

export function PinIcon({ className, ...props }: AnimatedIconProps) {
  return (
    <IconSvg
      className={cn(move, "origin-bottom group-hover:-rotate-[18deg]", className)}
      {...props}
    >
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </IconSvg>
  )
}

/** The copy glyph morphs into a check while `copied` is true. */
export function CopyCheckIcon({
  copied = false,
  className,
  ...props
}: AnimatedIconProps & { copied?: boolean }) {
  return (
    <IconSvg className={className} {...props}>
      <g
        className={cn(
          box,
          "transition-[opacity,transform] duration-(--dur-base) ease-(--ease-out) motion-reduce:transition-none",
          copied && "scale-[0.7] opacity-0"
        )}
      >
        <rect width="14" height="14" x="8" y="8" rx="2" />
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
      </g>
      <path
        d="m5 12.5 4.5 4.5L19 7.5"
        strokeDasharray={16}
        strokeDashoffset={copied ? 0 : 16}
        className="transition-[stroke-dashoffset] duration-[350ms] ease-(--ease-out) motion-reduce:transition-none"
      />
    </IconSvg>
  )
}

/** Points right, rotates to point down while `open`. */
export function ChevronIcon({
  open = false,
  className,
  ...props
}: AnimatedIconProps & { open?: boolean }) {
  return (
    <IconSvg className={cn(move, open && "rotate-90", className)} {...props}>
      <path d="m9 18 6-6-6-6" />
    </IconSvg>
  )
}

export function ArrowRightIcon({ className, ...props }: AnimatedIconProps) {
  return (
    <IconSvg className={cn(move, "group-hover:translate-x-0.5", className)} {...props}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </IconSvg>
  )
}

export function TrashIcon({ className, ...props }: AnimatedIconProps) {
  return (
    <IconSvg className={className} {...props}>
      <g
        className={cn(
          "origin-[4px_6px] transition-transform duration-(--dur-base) ease-(--ease-out) group-hover:-translate-y-0.5 group-hover:-rotate-[8deg] motion-reduce:transition-none motion-reduce:transform-none"
        )}
      >
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
      </g>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </IconSvg>
  )
}

/** Flickers on hover, or continuously when `active`. */
export function FlameIcon({
  active = false,
  className,
  ...props
}: AnimatedIconProps & { active?: boolean }) {
  return (
    <IconSvg
      className={cn(
        "origin-bottom motion-reduce:animate-none motion-reduce:transform-none group-hover:animate-[lp-flicker_900ms_ease-in-out_infinite]",
        active && "animate-[lp-flicker_1400ms_ease-in-out_infinite]",
        className
      )}
      {...props}
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </IconSvg>
  )
}

/** Sun and moon swap places as `dark` flips. */
/** Morphs between a sun (light), a moon (dark) and a monitor (system). */
export function ThemeIcon({
  theme,
  className,
  ...props
}: AnimatedIconProps & { theme: "system" | "light" | "dark" }) {
  const swap =
    "transition-[transform,opacity] duration-[400ms] ease-(--ease-out) motion-reduce:transition-none"
  return (
    <IconSvg className={className} {...props}>
      <g className={cn(box, swap, theme !== "light" && "scale-50 rotate-90 opacity-0")}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </g>
      <path
        d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"
        className={cn(box, swap, theme !== "dark" && "scale-50 -rotate-[60deg] opacity-0")}
      />
      <g className={cn(box, swap, theme !== "system" && "scale-50 translate-y-1 opacity-0")}>
        <rect width="20" height="14" x="2" y="3" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </g>
    </IconSvg>
  )
}

/** The left panel shrinks while `collapsed`. */
export function SidebarToggleIcon({
  collapsed = false,
  className,
  ...props
}: AnimatedIconProps & { collapsed?: boolean }) {
  return (
    <IconSvg className={className} {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <rect
        x="4"
        y="4.2"
        width="4.2"
        height="15.6"
        rx="0.6"
        fill="currentColor"
        stroke="none"
        opacity={0.4}
        className={cn(
          "origin-left [transform-box:fill-box] transition-transform duration-(--dur-slow) ease-(--ease-out) motion-reduce:transition-none",
          collapsed && "scale-x-[0.25]"
        )}
      />
    </IconSvg>
  )
}

/** The lens widens when an ancestor with `group` is hovered. */
export function SearchIcon({ className, ...props }: AnimatedIconProps) {
  return (
    <IconSvg className={className} {...props}>
      <circle
        cx="11"
        cy="11"
        r="7"
        className={cn(box, move, "group-hover:scale-x-[1.14]")}
      />
      <path d="m21 21-4.3-4.3" className={cn(move, "group-hover:translate-x-[1.5px]")} />
    </IconSvg>
  )
}
