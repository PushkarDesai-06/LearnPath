"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Menu, X } from "lucide-react";
import { LogoLockup } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
] as const;

const SCROLL_THRESHOLD = 8;

function subscribeToScroll(notify: () => void) {
  window.addEventListener("scroll", notify, { passive: true });
  return () => window.removeEventListener("scroll", notify);
}

function useScrolled() {
  return useSyncExternalStore(
    subscribeToScroll,
    () => window.scrollY > SCROLL_THRESHOLD,
    () => false,
  );
}

export function LandingNav() {
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-(--dur-slow) ease-(--ease-out)",
        scrolled
          ? "border-border bg-background/75 backdrop-blur-md"
          : "border-transparent bg-transparent",
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4"
      >
        <Link
          href="/"
          aria-label="LearnPath home"
          className="rounded-md outline-offset-4"
        >
          <LogoLockup />
        </Link>

        <ul className="ml-6 hidden items-center gap-1 sm:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-muted-foreground hover:text-foreground hover:bg-hover rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-(--dur-fast)"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link href="/login">Start learning</Link>
          </Button>
          <div ref={menuRef} className="relative sm:hidden">
            <Button
              variant="ghost"
              size="icon"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="landing-menu"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X /> : <Menu />}
            </Button>
            {open && (
              <ul
                id="landing-menu"
                className="bg-popover text-popover-foreground absolute top-full right-0 mt-2 flex w-44 flex-col gap-0.5 rounded-xl p-1 shadow-(--shadow-pop) animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none"
              >
                {[...LINKS, { href: "/login", label: "Log in" }].map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="hover:bg-hover block rounded-lg px-2.5 py-2 text-[13px] font-medium"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
