"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion, useInView } from "./useInView";

const THREAD = [
  { from: "learner", text: "Just tell me why my group-by returns NaN." },
  {
    from: "tutor",
    text: "Close. What does that column's dtype say, and what does sum() do with a value it can't add?",
  },
  { from: "learner", text: "Oh. It's an object column, not a float." },
] as const;

const TOTAL = THREAD.reduce((sum, message) => sum + message.text.length, 0);
const OFFSETS = THREAD.map((_, index) =>
  THREAD.slice(0, index).reduce((sum, message) => sum + message.text.length, 0),
);
const CHAR_MS = 22;
const TURN_PAUSE_MS = 500;

function isTurnBoundary(typed: number) {
  let end = 0;
  return THREAD.some((message) => {
    end += message.text.length;
    return typed === end;
  });
}

export function TutorDemo() {
  const { ref, inView } = useInView<HTMLDivElement>(0.4);
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    if (!inView || typed >= TOTAL) return;
    const step = prefersReducedMotion() ? TOTAL : 1;
    const wait = typed === 0 || isTurnBoundary(typed) ? TURN_PAUSE_MS : CHAR_MS;
    const id = setTimeout(
      () => setTyped((value) => Math.min(TOTAL, value + step)),
      step === TOTAL ? 0 : wait,
    );
    return () => clearTimeout(id);
  }, [inView, typed]);

  return (
    <div
      ref={ref}
      className="bg-surface-2 border-border flex flex-col gap-2 rounded-xl border p-3.5"
    >
      <ol className="sr-only">
        {THREAD.map((message) => (
          <li key={message.text}>
            {message.from}: {message.text}
          </li>
        ))}
      </ol>
      <div aria-hidden className="flex flex-col gap-2">
        {THREAD.map((message, index) => {
          const shown = Math.max(
            0,
            Math.min(message.text.length, typed - OFFSETS[index]),
          );
          return (
            <p
              key={message.text}
              className={cn(
                "max-w-[88%] rounded-2xl border px-3 py-2 text-[13px] leading-relaxed transition-opacity duration-(--dur-slow)",
                message.from === "learner"
                  ? "bg-surface-3 border-border ml-auto rounded-br-sm"
                  : "bg-surface-1 border-border mr-auto rounded-bl-sm",
                shown === 0 && "opacity-0",
              )}
            >
              {message.text.slice(0, shown)}
              <span className="invisible">{message.text.slice(shown)}</span>
            </p>
          );
        })}
      </div>
    </div>
  );
}
