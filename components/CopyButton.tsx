"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Copies `text` to the clipboard and confirms in place for a moment. */
export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={copied ? "Copied" : "Copy code"}
      className={cn("text-muted-foreground hover:text-foreground", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard blocked (permissions, insecure context): nothing to undo.
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}
