"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const ACCOUNT_SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "appearance", label: "Appearance" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "account", label: "Account" },
] as const;

/** Sub navigation for the settings page. Highlights the section nearest the top. */
export function AccountNav() {
  const [active, setActive] = useState<string>(ACCOUNT_SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    for (const { id } of ACCOUNT_SECTIONS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="Settings"
      className="flex gap-1 overflow-x-auto md:sticky md:top-16 md:flex-col md:self-start"
    >
      {ACCOUNT_SECTIONS.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={active === id ? "true" : undefined}
          onClick={() => setActive(id)}
          className={cn(
            "flex h-8 shrink-0 items-center rounded-md px-2.5 text-[13px] text-fg-2 transition-colors duration-(--dur-fast) outline-none hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground",
            active === id && "bg-active text-foreground",
          )}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
