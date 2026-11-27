import Link from "next/link";
import { LogoLockup } from "@/components/brand/Logo";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "/login", label: "Log in" },
] as const;

export function Footer() {
  return (
    <footer className="border-border border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8">
        <LogoLockup />
        <nav aria-label="Footer">
          <ul className="flex items-center gap-5">
            {LINKS.map((link) => (
              <li key={link.href}>
                {link.href.startsWith("/") ? (
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground text-[13px] transition-colors duration-(--dur-fast)"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground text-[13px] transition-colors duration-(--dur-fast)"
                  >
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
