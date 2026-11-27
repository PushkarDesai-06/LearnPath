import Link from "next/link";
import { LogoLockup } from "@/components/brand/Logo";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-10">
      <Link
        href="/"
        aria-label="LearnPath home"
        className="rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground [&_span:last-child]:text-lg"
      >
        <LogoLockup />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
