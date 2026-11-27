"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, EllipsisVertical } from "lucide-react";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoadingRing } from "@/components/ui/loading-ring";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";
import { stylesFor } from "@/lib/domain/variants";
import type { LessonBlockKind, VariantStyle } from "@/lib/db/models";
import type { BlockVariantDTO, BlockVariantResult } from "@/lib/data/types";

const POLL_MS = 2500;
const POLL_TIMEOUT_MS = 2 * 60 * 1000;

/** Menu wording, then the shorter tab label. */
const STYLE_LABELS: Record<VariantStyle, { menu: string; tab: string }> = {
  simpler: { menu: "Simpler", tab: "Simpler" },
  analogy: { menu: "Another analogy", tab: "Analogy" },
  example: { menu: "Worked example", tab: "Example" },
  walkthrough: { menu: "Walk me through it", tab: "Walkthrough" },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * "Explain it differently" for one lesson block, behind a ⋯ menu that appears
 * when the block is hovered or tapped. `children` is the block as the server
 * rendered it, kept as the Original tab. Picking a style POSTs to the
 * variants route, which answers once the rewrite is written; if another
 * request is already writing it the route says `generating` and this POSTs
 * again until it's ready. Rewrites are saved, so they come back on reload.
 */
export function BlockVariants({
  lessonId,
  blockKey,
  kind,
  initial,
  children,
}: {
  lessonId: string;
  blockKey: string;
  kind: LessonBlockKind;
  initial: BlockVariantDTO[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [variants, setVariants] = useState<BlockVariantDTO[]>(initial);
  const [tab, setTab] = useState<string>("original");
  const [pending, setPending] = useState<VariantStyle | null>(null);
  const [error, setError] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const styles = stylesFor(kind);
  if (!styles.length) return <>{children}</>;
  const hasVariant = (style: VariantStyle) => variants.some((v) => v.style === style);

  async function request(style: VariantStyle) {
    if (hasVariant(style)) {
      setTab(style);
      return;
    }
    setPending(style);
    setError("");
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    try {
      for (;;) {
        const res = await api<BlockVariantResult>(
          `/api/lesson/${lessonId}/blocks/${encodeURIComponent(blockKey)}/variants`,
          { body: { style } },
        );
        if (!mounted.current) return;
        if (res.status === "ready") {
          setVariants((list) => [
            ...list.filter((v) => v.style !== style),
            { style, markdown: res.markdown },
          ]);
          setTab(style);
          return;
        }
        if (Date.now() >= deadline) {
          throw new Error("This is taking longer than expected. Try again in a moment.");
        }
        await sleep(POLL_MS);
        if (!mounted.current) return;
      }
    } catch (err) {
      if (!mounted.current) return;
      if (err instanceof ApiClientError && err.status === 401) {
        router.push("/login");
        return;
      }
      if (err instanceof ApiClientError && err.status === 403) {
        router.refresh();
        return;
      }
      setError(err instanceof Error ? err.message : "Couldn't rewrite this block.");
    } finally {
      if (mounted.current) setPending(null);
    }
  }

  // The ⋯ button stays out of the way until the block is hovered or tapped
  // (tapping focuses the block, so :focus-within reveals it on touch screens).
  // While hidden it ignores pointers, so the first tap reveals rather than opens.
  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Explain this block differently"
          disabled={!!pending}
          className={cn(
            "bg-background/80 text-muted-foreground absolute top-0 right-0 z-10 backdrop-blur-sm lg:-right-10",
            "transition-opacity duration-150",
            "pointer-events-none opacity-0",
            "group-hover/block:pointer-events-auto group-hover/block:opacity-100",
            "group-focus-within/block:pointer-events-auto group-focus-within/block:opacity-100",
            "data-[state=open]:pointer-events-auto data-[state=open]:opacity-100",
          )}
        >
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Explain differently</DropdownMenuLabel>
        {styles.map((style) => (
          <DropdownMenuItem key={style} onSelect={() => void request(style)}>
            {STYLE_LABELS[style].menu}
            {hasVariant(style) && (
              <Check className="text-muted-foreground ml-auto size-3.5" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const status = (pending || error) && (
    <p role="status" className="flex items-center gap-2 text-xs">
      {pending ? (
        <span className="text-muted-foreground animate-in fade-in-0 flex items-center gap-2 duration-200">
          <LoadingRing className="size-3" />
          Rewriting: {STYLE_LABELS[pending].menu.toLowerCase()}…
        </span>
      ) : (
        <span className="text-destructive">{error}</span>
      )}
    </p>
  );

  return (
    <div tabIndex={-1} className="group/block relative flex flex-col gap-2 outline-none">
      {menu}
      {variants.length ? (
        <Tabs value={tab} onValueChange={setTab} className="gap-3">
          <TabsList variant="line" className="-ml-1.5 max-w-[calc(100%-2.5rem)] lg:max-w-full">
            <TabsTrigger value="original" className="text-xs">
              Original
            </TabsTrigger>
            {variants.map((v) => (
              <TabsTrigger key={v.style} value={v.style} className="text-xs">
                {STYLE_LABELS[v.style].tab}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="original">{children}</TabsContent>
          {variants.map((v) => (
            <TabsContent key={v.style} value={v.style}>
              <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 animate-in fade-in-0 duration-300">
                <Markdown>{v.markdown}</Markdown>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        children
      )}
      {status}
    </div>
  );
}
