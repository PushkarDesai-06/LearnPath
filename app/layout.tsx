import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { Nav } from "@/components/Nav";
import { NavBar } from "@/components/NavBar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { NavigationProgress } from "@/components/NavigationProgress";
import { ActiveTopicProvider } from "@/components/ActiveTopic";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LearnPath",
  description: "Personalized, adaptive learning paths generated for you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        {/* Spans the nav and the page so a route whose topic isn't in the URL
            (a lesson) can announce it to the topic switcher. `children` stays a
            server-rendered subtree — the provider only passes it through. */}
        <ThemeProvider>
        <TooltipProvider delayDuration={500} skipDelayDuration={300}>
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <ActiveTopicProvider>
          {/* The Nav reads the session cookie. Behind its own boundary so that
              read doesn't hold the first streamed byte; the fallback is the
              logo-only bar. */}
          <Suspense fallback={<NavBar user={null} topics={[]} />}>
            <Nav />
          </Suspense>
          {/* The <main> wrapper lives in the route-group layouts: `(app)` sets
              the reading-width container, `(marketing)` stays full-bleed. */}
          {children}
        </ActiveTopicProvider>
        <Toaster position="bottom-right" />
        </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
