"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LogoLockup } from "@/components/brand/Logo";
import { useNavigate } from "@/lib/client/progress";
import { hasOpenOverlay, isPlainShortcut } from "@/lib/client/keys";
import { cn } from "@/lib/utils";

const STEPS = ["Describe", "Assess", "Path"] as const;
const EXIT_HREF = "/topics";

function currentStep(pathname: string) {
  if (pathname.startsWith("/onboarding")) return 0;
  if (pathname.startsWith("/assessment")) return 1;
  return 2;
}

/**
 * Slim top bar for onboarding and assessment: logo, where the learner is in
 * the flow, and Exit. Progress is saved and resumable, so exiting never asks.
 */
export function FocusBar() {
  const pathname = usePathname();
  const navigate = useNavigate();
  const step = currentStep(pathname);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !isPlainShortcut(event) || hasOpenOverlay())
        return;
      navigate.push(EXIT_HREF);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  return (
    <header className="sticky top-0 z-20 flex h-11 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:px-4">
      <Link
        href="/topics"
        aria-label="LearnPath, back to topics"
        className="rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <LogoLockup />
      </Link>
      <ol
        aria-label="Progress"
        className="mx-auto flex items-center gap-1.5 text-[12.5px]"
      >
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className="flex items-center gap-1.5"
          >
            {index > 0 && (
              <span aria-hidden className="h-px w-4 bg-border-strong" />
            )}
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 transition-colors duration-(--dur-base)",
                index === step && "bg-active font-medium text-foreground",
                index < step && "text-fg-2",
                index > step && "text-faint",
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="sm">
            <Link
              href={EXIT_HREF}
              aria-label="Exit. Progress is saved and you can resume later."
            >
              <X data-icon="inline-start" />
              Exit
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent shortcut="Esc">
          Progress is saved, resume anytime
        </TooltipContent>
      </Tooltip>
    </header>
  );
}
