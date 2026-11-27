"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useInView } from "./useInView";

/**
 * Flips `data-shown` once when scrolled into view. With `reveal` it also fades
 * and rises; without, it only exposes the flag so descendants can key
 * transitions off `[data-shown="true"]`.
 */
export function ScrollReveal({
  children,
  className,
  delay = 0,
  reveal = true,
  threshold = 0.15,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  reveal?: boolean;
  threshold?: number;
}) {
  const { ref, inView } = useInView<HTMLDivElement>(threshold);
  return (
    <div
      ref={ref}
      data-shown={inView}
      className={cn(reveal && "lp-reveal", className)}
      style={{ "--lp-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
