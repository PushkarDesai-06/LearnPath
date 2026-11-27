import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons/animated";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "./ScrollReveal";

export function FinalCta() {
  return (
    <section
      aria-labelledby="cta-heading"
      className="mx-auto w-full max-w-6xl px-4 py-24 sm:py-32"
    >
      <ScrollReveal className="bg-surface-1 border-border relative overflow-hidden rounded-3xl border px-6 py-14 text-center sm:py-20">
        <div aria-hidden className="lp-hero-glow absolute inset-0 opacity-70" />
        <div className="relative flex flex-col items-center gap-4">
          <h2
            id="cta-heading"
            className="h-display max-w-lg text-3xl sm:text-4xl"
          >
            Start where you are, not at lesson one.
          </h2>
          <p className="text-muted-foreground max-w-md text-[15px]">
            Describe a topic and take the quiz. Your first path is built from
            there.
          </p>
          <Button size="lg" asChild className="group mt-2">
            <Link href="/login">
              Start learning
              <ArrowRightIcon />
            </Link>
          </Button>
        </div>
      </ScrollReveal>
    </section>
  );
}
