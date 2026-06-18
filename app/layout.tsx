import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Inter,
  DM_Sans,
  Manrope,
  Space_Grotesk,
  Plus_Jakarta_Sans,
  Instrument_Serif,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Toaster } from "@/components/ui/sonner";

// ── Default body + mono ──────────────────────────────────────────────────────
const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// ── Sans-serif sampler ───────────────────────────────────────────────────────
// Swap any of these in via the Tailwind class shown next to each one.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" }); // font-inter
const dmSans = DM_Sans({ variable: "--font-dm", subsets: ["latin"], display: "swap" }); // font-dm
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" }); // font-manrope
const spaceGrotesk = Space_Grotesk({ variable: "--font-space", subsets: ["latin"], display: "swap" }); // font-space
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], display: "swap" }); // font-jakarta

// ── Serif option (if you want one big editorial heading) ────────────────────
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
}); // font-instrument

// ── Alt mono ─────────────────────────────────────────────────────────────────
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
}); // font-jetbrains

export const metadata: Metadata = {
  title: "LearnPath",
  description: "Personalized, adaptive learning paths generated for you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontVars = [
    geistSans.variable,
    geistMono.variable,
    inter.variable,
    dmSans.variable,
    manrope.variable,
    spaceGrotesk.variable,
    jakarta.variable,
    instrument.variable,
    jetbrains.variable,
  ].join(" ");

  return (
    <html lang="en" className={`dark ${fontVars} h-full antialiased`}>
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
        <Toaster richColors position="bottom-right" theme="dark" />
      </body>
    </html>
  );
}
