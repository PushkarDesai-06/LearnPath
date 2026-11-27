"use client";

import { useRef, useState } from "react";

const FRONT = 'What does sales.groupby("region").sum() return?';
const BACK = "One row per region, with the numeric columns summed.";

export function FlashcardDemo() {
  const [flipped, setFlipped] = useState(false);
  const lastInput = useRef<string>("");

  return (
    <div
      className="lp-flip"
      data-flipped={flipped}
      onPointerEnter={(event) => {
        lastInput.current = event.pointerType;
        if (event.pointerType === "mouse") setFlipped(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setFlipped(false);
      }}
    >
      <button
        type="button"
        aria-pressed={flipped}
        aria-label={`Flashcard. ${FRONT} Answer: ${BACK}`}
        onPointerDown={(event) => {
          lastInput.current = event.pointerType;
        }}
        onKeyDown={() => {
          lastInput.current = "key";
        }}
        onClick={() => {
          if (lastInput.current !== "mouse") setFlipped((value) => !value);
        }}
        className="lp-flip-inner block h-28 w-full rounded-xl text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <span className="lp-face lp-face-front bg-surface-1 border-border-strong absolute inset-0 flex flex-col justify-between rounded-xl border p-3.5">
          <span className="text-[13px] font-medium">{FRONT}</span>
          <span className="text-faint text-[11px]">Hover or tap to flip</span>
        </span>
        <span
          aria-hidden
          className="lp-face lp-face-back bg-surface-3 border-border-strong flex flex-col justify-between rounded-xl border p-3.5"
        >
          <span className="text-[13px]">{BACK}</span>
          <span className="text-faint text-[11px]">Answer</span>
        </span>
      </button>
    </div>
  );
}
