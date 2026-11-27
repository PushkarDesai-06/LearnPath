"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FlaskConical, Footprints, Lightbulb, Sparkles, Sprout, type LucideIcon } from "lucide-react";
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

/** Menu wording, the shorter tab label, and a one line promise of what you get. */
const STYLE_LABELS: Record<
  VariantStyle,
  { menu: string; tab: string; description: string; Icon: LucideIcon }
> = {
  simpler: {
    menu: "Simpler",
    tab: "Simpler",
    description: "Plain words and fewer terms",
    Icon: Sprout,
  },
  analogy: {
    menu: "Another analogy",
    tab: "Analogy",
    description: "Compare it to something familiar",
    Icon: Lightbulb,
  },
  example: {
    menu: "Worked example",
    tab: "Example",
    description: "See it applied to a concrete case",
    Icon: FlaskConical,
  },
  walkthrough: {
    menu: "Walk me through it",
    tab: "Walkthrough",
    description: "Go through the code step by step",
    Icon: Footprints,
  },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * "Explain it differently" for one lesson block, behind a compact ghost button
 * under the block that appears when it is hovered or focused (always on touch). `children` is the block as the server
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

  const control = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          disabled={!!pending}
          className={cn(
            "text-muted-foreground self-start transition-opacity duration-(--dur-fast)",
            "opacity-0 group-hover/block:opacity-100 group-focus-within/block:opacity-100",
            "data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100",
            (variants.length > 0 || pending) && "opacity-100",
          )}
        >
          <Sparkles data-icon="inline-start" />
          Explain differently
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Explain differently</DropdownMenuLabel>
        {styles.map((style) => {
          const { Icon, menu, description } = STYLE_LABELS[style];
          return (
            <DropdownMenuItem
              key={style}
              onSelect={() => void request(style)}
              className="items-start gap-2.5 py-1.5"
            >
              <Icon className="mt-0.5" />
              <span className="flex min-w-0 flex-col">
                <span>{menu}</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {description}
                </span>
              </span>
              {hasVariant(style) && (
                <Check className="text-muted-foreground mt-0.5 ml-auto size-3.5" />
              )}
            </DropdownMenuItem>
          );
        })}
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
    <div tabIndex={-1} className="group/block flex flex-col gap-2 outline-none">
      {variants.length ? (
        <Tabs value={tab} onValueChange={setTab} className="gap-3">
          <TabsList className="self-start">
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
              <div className="animate-in fade-in-0 duration-300">
                <Markdown>{v.markdown}</Markdown>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        children
      )}
      {control}
      {status}
    </div>
  );
}
