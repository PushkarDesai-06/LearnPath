"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const STYLES = [
  {
    id: "original",
    label: "Original",
    text: "A group-by splits the table by key, applies a function to each group, then combines the results into one row per key.",
  },
  {
    id: "simpler",
    label: "Simpler",
    text: "Put rows with the same region together, then add up each pile.",
  },
  {
    id: "analogy",
    label: "Analogy",
    text: "Think of a mail sorter. Each letter drops into the pigeonhole for its region, and only then do you weigh each pile.",
  },
  {
    id: "example",
    label: "Example",
    text: 'sales.groupby("region")["revenue"].sum() gives one total per region.',
  },
] as const;

export function ExplainDemo() {
  const [active, setActive] = useState<(typeof STYLES)[number]["id"]>("original");
  const current = STYLES.find((style) => style.id === active) ?? STYLES[0];

  return (
    <div className="bg-surface-2 border-border flex flex-col gap-3 rounded-xl border p-3.5">
      <p
        key={current.id}
        aria-live="polite"
        className={cn(
          "min-h-[84px] text-[13px] leading-relaxed animate-in fade-in-0 duration-200 motion-reduce:animate-none",
          current.id === "example" && "font-mono text-xs",
        )}
      >
        {current.text}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground mr-1 text-xs">
          Explain differently
        </span>
        {STYLES.slice(1).map((style) => (
          <button
            key={style.id}
            type="button"
            aria-pressed={active === style.id}
            onClick={() =>
              setActive((value) => (value === style.id ? "original" : style.id))
            }
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors duration-(--dur-fast) outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
              "shadow-[inset_0_0_0_1px_var(--border-strong)] hover:bg-hover",
              active === style.id && "bg-active",
            )}
          >
            {style.label}
          </button>
        ))}
      </div>
    </div>
  );
}
