"use client"

import { useCallback, useSyncExternalStore } from "react"
import { flushSync } from "react-dom"
import { useTheme } from "next-themes"

export type ThemeChoice = "system" | "light" | "dark"

export const THEME_ORDER: readonly ThemeChoice[] = ["system", "light", "dark"]

export const THEME_LABEL: Record<ThemeChoice, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
}

const subscribeNoop = () => () => {}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown
}

function crossfade(update: () => void) {
  const doc = document as ViewTransitionDocument
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (!doc.startViewTransition || reduced) {
    update()
    return
  }
  doc.startViewTransition(() => flushSync(update))
}

export function useThemeCycle() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  )

  const choice: ThemeChoice = mounted && THEME_ORDER.includes(theme as ThemeChoice)
    ? (theme as ThemeChoice)
    : "system"
  const isDark = mounted && resolvedTheme === "dark"

  const set = useCallback(
    (next: ThemeChoice) => crossfade(() => setTheme(next)),
    [setTheme]
  )

  const cycle = useCallback(() => {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(choice) + 1) % THEME_ORDER.length]
    set(next)
  }, [choice, set])

  /** Flip between light and dark, ignoring "system". */
  const toggle = useCallback(() => set(isDark ? "light" : "dark"), [isDark, set])

  return { theme: choice, isDark, mounted, setTheme: set, cycle, toggle }
}
