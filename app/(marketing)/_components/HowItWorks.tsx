import { BookOpen, Flag, Layers, Pencil, RefreshCw } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

const STEPS = [
  {
    title: "Describe",
    icon: Pencil,
    text: "Say what you want to learn. Follow-up questions sharpen a vague goal.",
  },
  {
    title: "Assess",
    icon: Flag,
    text: "A short adaptive quiz finds your level, with an honest I don't know option.",
  },
  {
    title: "Path",
    icon: Layers,
    text: "A curriculum is written for that level and ordered by prerequisite.",
  },
  {
    title: "Learn",
    icon: BookOpen,
    text: "Lessons are written for you, with practice that grades as you answer.",
  },
  {
    title: "Adapt",
    icon: RefreshCw,
    text: "Every answer moves your mastery. The path skips, reorders and revisits.",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="lp-anchor mx-auto w-full max-w-6xl px-4 pt-24 sm:pt-32"
    >
      <ScrollReveal className="mx-auto max-w-xl text-center">
        <h2 id="how-heading" className="h-display text-3xl sm:text-4xl">
          From a vague goal to a working path
        </h2>
        <p className="text-muted-foreground mt-3 text-[15px]">
          Five steps, and the last one never stops.
        </p>
      </ScrollReveal>

      <ScrollReveal reveal={false} threshold={0.35} className="mt-14">
        <ol className="relative grid gap-8 md:grid-cols-5 md:gap-4">
          <span
            aria-hidden
            className="bg-border-strong absolute top-4 bottom-4 left-4 w-px md:top-4 md:right-[10%] md:bottom-auto md:left-[10%] md:h-px md:w-auto"
          />
          <span
            aria-hidden
            className="lp-line bg-foreground absolute top-4 bottom-4 left-4 w-px md:top-4 md:right-[10%] md:bottom-auto md:left-[10%] md:h-px md:w-auto"
          />
          {STEPS.map(({ title, icon: Icon, text }, index) => (
            <li
              key={title}
              className="relative flex gap-4 md:flex-col md:items-center md:gap-3 md:text-center"
            >
              <span className="bg-surface-1 border-border-strong text-foreground relative flex size-8 shrink-0 items-center justify-center rounded-full border">
                <Icon className="size-4" aria-hidden />
              </span>
              <div>
                <h3 className="text-sm font-semibold">
                  <span className="text-faint mr-1.5 font-mono text-xs tabular-nums">
                    {index + 1}
                  </span>
                  {title}
                </h3>
                <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
                  {text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </ScrollReveal>
    </section>
  );
}
