"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { progress } from "@/lib/client/progress"

const SHOW_DELAY_MS = 80
const TRICKLE_MS = 200
const TRICKLE_CEILING = 0.85
const SAFETY_TIMEOUT_MS = 10_000
const FADE_MS = 300

function isTrackedNavigation(event: MouseEvent) {
  if (event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  const anchor = (event.target as Element | null)?.closest?.("a[href]")
  if (!(anchor instanceof HTMLAnchorElement)) return false
  if (anchor.target && anchor.target !== "_self") return false
  if (anchor.hasAttribute("download")) return false
  const url = new URL(anchor.href, window.location.href)
  if (url.origin !== window.location.origin) return false
  const here = window.location
  if (url.pathname === here.pathname && url.search === here.search) return false
  return true
}

export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    progress.finishNavigation()
  }, [pathname, searchParams])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (isTrackedNavigation(event)) progress.startNavigation()
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return

    let value = 0
    let visible = false
    let showTimer: ReturnType<typeof setTimeout> | undefined
    let trickleTimer: ReturnType<typeof setInterval> | undefined
    let safetyTimer: ReturnType<typeof setTimeout> | undefined
    let fadeTimer: ReturnType<typeof setTimeout> | undefined

    const paint = (scale: number, opacity: number, animate = true) => {
      bar.style.transition = animate
        ? "transform 400ms var(--ease-out), opacity 300ms"
        : "none"
      bar.style.transform = `scaleX(${scale})`
      bar.style.opacity = String(opacity)
    }

    const reveal = () => {
      visible = true
      clearTimeout(fadeTimer)
      value = 0.08
      paint(0, 0, false)
      void bar.offsetWidth
      paint(value, 1)
      trickleTimer = setInterval(() => {
        value += (TRICKLE_CEILING - value) * 0.1
        paint(value, 1)
      }, TRICKLE_MS)
    }

    const begin = () => {
      if (showTimer || visible) return
      showTimer = setTimeout(() => {
        showTimer = undefined
        reveal()
      }, SHOW_DELAY_MS)
      safetyTimer = setTimeout(() => progress.reset(), SAFETY_TIMEOUT_MS)
    }

    const end = () => {
      clearTimeout(safetyTimer)
      safetyTimer = undefined
      if (showTimer) {
        clearTimeout(showTimer)
        showTimer = undefined
        return
      }
      if (!visible) return
      visible = false
      clearInterval(trickleTimer)
      paint(1, 1)
      fadeTimer = setTimeout(() => {
        paint(1, 0)
        fadeTimer = setTimeout(() => paint(0, 0, false), FADE_MS)
      }, 200)
    }

    const sync = () => (progress.isBusy() ? begin() : end())
    const unsubscribe = progress.subscribe(sync)
    sync()

    return () => {
      unsubscribe()
      clearTimeout(showTimer)
      clearTimeout(safetyTimer)
      clearTimeout(fadeTimer)
      clearInterval(trickleTimer)
    }
  }, [])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
    >
      <div
        ref={barRef}
        className="nav-progress-bar absolute inset-0"
        style={{ transform: "scaleX(0)", opacity: 0 }}
      />
    </div>
  )
}
