import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/CopyButton";

/**
 * Renders LLM-generated markdown (lesson content, tutor replies, explanations).
 * Styled with the Tailwind typography plugin + a few theme-aligned overrides so
 * it inherits the shadcn neutral palette and dark mode. Raw HTML in the source
 * is NOT rendered (react-markdown escapes it), safe for model output.
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
        "prose prose-sm dark:prose-invert max-w-none",
        // align code + links with the theme tokens
        "prose-pre:bg-muted prose-pre:text-foreground prose-pre:border",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-a:text-primary prose-headings:scroll-m-20",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // Only fences that name a language are highlighted; tones come from
        // `.hljs-*` rules in globals.css (lightness, not hue).
        rehypePlugins={[[rehypeHighlight, { detect: false }]]}
        components={{ pre: CodeFence }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Fenced code: language label, copy button, highlighted body. */
function CodeFence({ children, node }: React.ComponentProps<"pre"> & { node?: unknown }) {
  const text = textOf(node).replace(/\n$/, "");
  const language = languageOf(node);
  return (
    <div className="not-prose border-border/60 bg-surface-1 my-3 overflow-hidden rounded-xl border">
      <div className="border-border/60 flex items-center justify-between border-b px-4 py-1.5">
        <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.14em]">
          {language ?? "code"}
        </span>
        <CopyButton text={text} />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">{children}</pre>
    </div>
  );
}

/** The fence's language, from the `language-xxx` class on its <code>. */
function languageOf(node: unknown): string | null {
  const code = (node as { children?: { properties?: { className?: unknown } }[] } | undefined)
    ?.children?.[0];
  const classes = code?.properties?.className;
  const list = Array.isArray(classes) ? classes : [];
  const lang = list.find((c): c is string => typeof c === "string" && c.startsWith("language-"));
  return lang ? lang.slice("language-".length) : null;
}

/** Plain text of a hast node (the code inside a <pre>). */
function textOf(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; value?: string; children?: unknown[] };
  if (n.type === "text") return n.value ?? "";
  return (n.children ?? []).map(textOf).join("");
}

const INLINE_ELEMENTS = ["p", "code", "strong", "em", "del", "a"];

/**
 * Markdown for one line of model text that sits inside other markup: a
 * question prompt, a radio label, a flashcard face. Only phrasing content is
 * kept (`code`, emphasis, links); block syntax is unwrapped to its text, so it
 * is safe inside a <label> or <p>.
 */
export function InlineMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      allowedElements={INLINE_ELEMENTS}
      unwrapDisallowed
      components={{
        p: ({ children }) => <>{children}</>,
        code: ({ children }) => (
          <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.9em]">{children}</code>
        ),
        a: ({ children, href }) => (
          <a href={href} className="text-primary underline underline-offset-2">
            {children}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
