import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { Nav } from "@/components/Nav";
import { NavBar } from "@/components/NavBar";
import { Toaster } from "@/components/ui/sonner";
import { ActiveTopicProvider } from "@/components/ActiveTopic";
import { SESSION_COOKIE } from "@/lib/auth/session";

// Three families: Geist for text, Geist Mono for eyebrows, stats and code, and
// Space Grotesk for display headings (`.h-display`, `font-heading`).
const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "LearnPath", template: "%s · LearnPath" },
  description: "Personalized, adaptive learning paths generated for you.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Cookie PRESENCE only (no DB read), so the topbar's loading fallback can
  // reserve the signed-in layout instead of flashing a logo-only bar.
  const signedIn = (await cookies()).has(SESSION_COOKIE);
  const fontVars = [geistSans.variable, geistMono.variable, spaceGrotesk.variable].join(" ");

  return (
    <html lang="en" className={`dark ${fontVars} h-full antialiased`}>
      <body className="bg-background text-foreground flex min-h-full flex-col">
        {/* Spans the nav and the page so a route whose topic isn't in the URL
            (a lesson) can announce it to the topic bar. `children` stays a
            server-rendered subtree — the provider only passes it through. */}
        <ActiveTopicProvider>
          {/* The Nav reads the session. Behind its own boundary so that read
              doesn't hold the first streamed byte. */}
          <Suspense fallback={<NavBar user={null} topics={[]} signedIn={signedIn} />}>
            <Nav />
          </Suspense>
          {/* The <main> wrapper lives in the route-group layouts: `(app)` sets
              the reading-width container, `(marketing)` stays full-bleed. */}
          {children}
        </ActiveTopicProvider>
        <Toaster position="bottom-right" theme="dark" />
      </body>
    </html>
  );
}
