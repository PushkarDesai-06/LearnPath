"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders LLM-generated markdown (lesson content, tutor replies, explanations).
 * Styled with the Tailwind typography plugin + a few theme-aligned overrides so
 * it inherits the shadcn neutral palette and dark mode. Raw HTML in the source
 * is NOT rendered (react-markdown escapes it), safe for model output.
 */
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        // align code + links with the theme tokens
        "prose-pre:bg-muted prose-pre:text-foreground prose-pre:border",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-a:text-primary prose-headings:scroll-m-20",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
