import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const WIDTHS = {
  /** Dashboard and lists. */
  wide: "max-w-[1040px]",
  /** Lessons, review, account: a comfortable line length. */
  reading: "max-w-[680px]",
} as const;

export type PageWidth = keyof typeof WIDTHS;

export function PageContainer({
  width = "wide",
  className,
  children,
}: {
  width?: PageWidth;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full flex-1 px-4 py-8 sm:px-6",
        WIDTHS[width],
        className,
      )}
    >
      {children}
    </div>
  );
}
