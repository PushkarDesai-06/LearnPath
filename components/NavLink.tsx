"use client";

/** A topbar link that marks itself current (`aria-current="page"`) on its route. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const current = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "rounded-md px-2.5 py-1 text-sm transition-colors",
        "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
        current ? "text-foreground bg-accent" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
