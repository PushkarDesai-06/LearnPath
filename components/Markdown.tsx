import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders LLM-generated markdown (lesson content, tutor replies, explanations).
 * Styled with the Tailwind typography plugin, with its color variables mapped to
 * the theme tokens so prose follows both light and dark without prose-invert.
 * Raw HTML in the source is NOT rendered (react-markdown escapes it), safe for model output.
 *
 * No "use client": it has no state or effects, so it renders on the server
 * inside Server Components (lesson prose ships as HTML) and on the client when
 * imported by a Client Component (practice explanations, tutor replies).
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
        "prose prose-sm max-w-none",
        "[--tw-prose-body:var(--fg-2)] [--tw-prose-headings:var(--foreground)] [--tw-prose-lead:var(--fg-2)] [--tw-prose-bold:var(--foreground)] [--tw-prose-links:var(--foreground)] [--tw-prose-counters:var(--faint)] [--tw-prose-bullets:var(--faint)] [--tw-prose-hr:var(--border)] [--tw-prose-quotes:var(--fg-2)] [--tw-prose-quote-borders:var(--border-strong)] [--tw-prose-captions:var(--faint)] [--tw-prose-code:var(--foreground)] [--tw-prose-pre-code:var(--foreground)] [--tw-prose-pre-bg:var(--surface-2)] [--tw-prose-th-borders:var(--border-strong)] [--tw-prose-td-borders:var(--border)]",
        "prose-pre:border prose-pre:border-border prose-pre:shadow-none",
        "prose-code:rounded prose-code:bg-surface-2 prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:font-normal prose-code:before:content-none prose-code:after:content-none",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "prose-a:underline prose-a:decoration-border-strong prose-a:underline-offset-2 hover:prose-a:decoration-foreground prose-headings:scroll-m-20",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
