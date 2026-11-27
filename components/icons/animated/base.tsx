import * as React from "react"
import { cn } from "@/lib/utils"

export type AnimatedIconProps = Omit<React.ComponentProps<"svg">, "children">

export const move =
  "transition-transform duration-(--dur-slow) ease-(--ease-out) motion-reduce:transition-none motion-reduce:transform-none"

export const box = "origin-center [transform-box:fill-box]"

export function IconSvg({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("size-4 shrink-0", className)}
      {...props}
    />
  )
}
