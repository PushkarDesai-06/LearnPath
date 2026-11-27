"use client";

import { useEffect, useRef } from "react";

/**
 * A 2px line pinned under the sticky page header that fills as the lesson is
 * scrolled. The scroll handler writes a transform straight to the element, so
 * a frame costs no React render and no layout.
 */
export function ReadingProgress() {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const root = document.documentElement;
      const scrollable = root.scrollHeight - root.clientHeight;
      const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
      bar.current?.style.setProperty(
        "transform",
        `scaleX(${Math.min(1, Math.max(0, ratio))})`,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none sticky top-11 z-20 h-0"
    >
      <div
        ref={bar}
        className="bg-foreground absolute top-0 left-0 h-0.5 w-full origin-left will-change-transform"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
