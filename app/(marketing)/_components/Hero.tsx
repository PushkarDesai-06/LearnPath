import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons/animated";
import { Button } from "@/components/ui/button";
import { ProductFrame } from "./ProductFrame";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 sm:pt-36">
      <div aria-hidden className="lp-hero-glow absolute inset-x-0 top-0 h-[560px]" />
      <div aria-hidden className="lp-hero-grid absolute inset-x-0 top-0 h-[560px]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 text-center">
        <h1
          className="lp-rise h-display max-w-3xl text-[2.5rem] sm:text-6xl"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          Learn anything, in the right order.
        </h1>
        <p
          className="lp-rise text-muted-foreground mt-5 max-w-xl text-base sm:text-lg"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          Describe a goal. LearnPath finds your level, builds the path, teaches
          it, and adapts as you go.
        </p>
        <div
          className="lp-rise mt-8 flex flex-wrap items-center justify-center gap-2"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          <Button size="lg" asChild className="group">
            <Link href="/login">
              Start learning
              <ArrowRightIcon />
            </Link>
          </Button>
          <Button size="lg" variant="ghost" asChild>
            <a href="#how-it-works">See how it works</a>
          </Button>
        </div>

        <div className="mt-14 w-full sm:mt-20">
          <ProductFrame />
        </div>
      </div>
    </section>
  );
}
