"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Reveals its children once they scroll into view.
 *
 * The observer flips a `data-shown` attribute directly on the node rather than
 * going through state: a landing page has a dozen of these, and none of them
 * needs a re-render to change opacity. It also keeps the effect free of the
 * setState React 19's `react-hooks/set-state-in-effect` rule flags.
 *
 * The animation itself is CSS (`.reveal` in globals.css), which is also where
 * it's turned off under `prefers-reduced-motion`.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  /** Stagger, in ms, for items revealed as a group. */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.shown = "true";
        io.disconnect(); // one-way: revealed stays revealed
      },
      // Fire a little before the element is fully on screen.
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      data-shown="false"
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn("reveal", className)}
    >
      {children}
    </Tag>
  );
}
