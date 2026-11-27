"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"

type Listener = () => void

let pending = 0
let navigating = false
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((listener) => listener())
}

export const progress = {
  /** Begin a unit of work. Overlapping calls are ref counted. */
  start() {
    pending += 1
    emit()
  },
  /** Finish one unit of work started with `start`. */
  done() {
    pending = Math.max(0, pending - 1)
    emit()
  },
  /** Mark a navigation as underway. Ended by `finishNavigation`. */
  startNavigation() {
    navigating = true
    emit()
  },
  finishNavigation() {
    if (!navigating) return
    navigating = false
    emit()
  },
  /** Clear everything, used by the safety timeout. */
  reset() {
    pending = 0
    navigating = false
    emit()
  },
  isBusy() {
    return pending > 0 || navigating
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

/** Runs the bar for as long as the promise is pending. */
export async function withProgress<T>(promise: Promise<T> | (() => Promise<T>)): Promise<T> {
  progress.start()
  try {
    return await (typeof promise === "function" ? promise() : promise)
  } finally {
    progress.done()
  }
}

type Router = ReturnType<typeof useRouter>

function targetsCurrentUrl(href: string) {
  const url = new URL(href, window.location.href)
  return (
    url.origin === window.location.origin &&
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  )
}

/** Router whose push and replace start the top loading bar. */
export function useNavigate(): Router {
  const router = useRouter()
  return useMemo(() => {
    const wrap =
      (method: "push" | "replace") =>
      (href: string, options?: Parameters<Router["push"]>[1]) => {
        if (!targetsCurrentUrl(href)) progress.startNavigation()
        router[method](href, options)
      }
    return { ...router, push: wrap("push"), replace: wrap("replace") }
  }, [router])
}
