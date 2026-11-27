"use client";

import { useEffect, useState } from "react";
import { StatusIcon } from "@/components/StatusIcon";

/** A quiet waiting state: rotating arc, a title, and optional steps that advance on their own. */
export function CalmState({
  title,
  hint,
  steps,
}: {
  title: string;
  hint?: string;
  steps?: readonly string[];
}) {
  const [step, setStep] = useState(0);
  const stepCount = steps?.length ?? 0;

  useEffect(() => {
    if (stepCount < 2) return;
    const timer = setInterval(
      () => setStep((n) => Math.min(n + 1, stepCount - 1)),
      3500,
    );
    return () => clearInterval(timer);
  }, [stepCount]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[50svh] flex-col items-center justify-center gap-3 text-center animate-in fade-in-0 duration-(--dur-slow) ease-(--ease-out)"
    >
      <StatusIcon status="generating" size={28} label="Working" />
      <p className="text-[15px] font-medium tracking-tight">{title}</p>
      {steps && (
        <p key={step} className="text-[13px] text-muted-foreground animate-in fade-in-0 slide-in-from-bottom-1 duration-(--dur-base)">
          {steps[step]}
        </p>
      )}
      {hint && <p className="text-[12px] text-faint">{hint}</p>}
    </div>
  );
}
