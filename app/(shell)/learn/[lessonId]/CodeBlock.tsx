"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyCheckIcon } from "@/components/icons/animated";
import type { LessonBlockDTO } from "@/lib/data/types";
import { BlockLabel } from "./BlockLabel";

const COPIED_HOLD_MS = 1500;

export function CodeBlock({ block }: { block: LessonBlockDTO }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(block.code ?? "");
    } catch {
      toast.error("Could not copy the code");
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_HOLD_MS);
  }

  return (
    <section className="flex flex-col gap-2">
      <BlockLabel kind="code" />
      <div className="bg-surface-2 border-border overflow-hidden rounded-xl border">
        <div className="border-border flex h-9 items-center justify-between gap-3 border-b pr-1.5 pl-3">
          <div className="flex min-w-0 items-center gap-2">
            {block.language && (
              <span className="text-muted-foreground font-mono text-[11px]">
                {block.language}
              </span>
            )}
            {block.caption && (
              <span className="text-faint truncate text-[11px]">{block.caption}</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => void copy()}
            aria-label="Copy code"
            className="text-muted-foreground"
          >
            <CopyCheckIcon copied={copied} data-icon="inline-start" />
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed">
          <code>{block.code}</code>
        </pre>
      </div>
    </section>
  );
}
