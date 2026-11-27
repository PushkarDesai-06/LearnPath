import { BookOpen, Layers, MessagesSquare, Route, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExplainDemo } from "./ExplainDemo";
import { FlashcardDemo } from "./FlashcardDemo";
import { Heatmap } from "./Heatmap";
import { PathDemo } from "./PathDemo";
import { QuizDemo } from "./QuizDemo";
import { ScrollReveal } from "./ScrollReveal";
import { TutorDemo } from "./TutorDemo";

function FeatureCard({
  icon: Icon,
  iconMotion,
  title,
  text,
  delay = 0,
  className,
  children,
}: {
  icon: LucideIcon;
  iconMotion: string;
  title: string;
  text: string;
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ScrollReveal delay={delay} className={className}>
      <article className="group bg-surface-1 border-border hover:border-border-strong flex h-full flex-col gap-4 rounded-2xl border p-5 transition-colors duration-(--dur-slow)">
        <div className="flex flex-col gap-2">
          <span className="bg-surface-2 border-border flex size-9 items-center justify-center rounded-lg border">
            <Icon
              aria-hidden
              className={cn(
                "size-4 transition-transform duration-(--dur-slow) ease-(--ease-out) motion-reduce:transition-none motion-reduce:transform-none",
                iconMotion,
              )}
            />
          </span>
          <h3 className="mt-1 text-base font-semibold">{title}</h3>
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            {text}
          </p>
        </div>
        <div className="mt-auto">{children}</div>
      </article>
    </ScrollReveal>
  );
}

export function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="lp-anchor mx-auto w-full max-w-6xl px-4 pt-24 sm:pt-32"
    >
      <ScrollReveal className="mx-auto max-w-xl text-center">
        <h2 id="features-heading" className="h-display text-3xl sm:text-4xl">
          Built to teach, not to play videos
        </h2>
        <p className="text-muted-foreground mt-3 text-[15px]">
          Try the demos. They behave like the real thing, with made up data.
        </p>
      </ScrollReveal>

      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <FeatureCard
          className="lg:col-span-2"
          icon={Target}
          iconMotion="group-hover:scale-110 group-hover:rotate-12"
          title="Adaptive quiz"
          text="Questions span difficulty bands, and every answer, including I don't know, reshapes the estimate of where you stand."
        >
          <QuizDemo />
        </FeatureCard>
        <FeatureCard
          className="lg:col-span-2"
          delay={80}
          icon={BookOpen}
          iconMotion="group-hover:-rotate-6 group-hover:scale-110"
          title="Interactive lessons"
          text="Lessons are written for your level. If a block does not land, ask for it simpler, as an analogy, or with an example."
        >
          <ExplainDemo />
        </FeatureCard>
        <FeatureCard
          className="md:col-span-2 lg:col-span-2"
          delay={160}
          icon={MessagesSquare}
          iconMotion="group-hover:-translate-y-0.5 group-hover:scale-110"
          title="Socratic tutor"
          text="Grounded in your own lessons. Ask for the answer and it hands you the next question instead."
        >
          <TutorDemo />
        </FeatureCard>
        <FeatureCard
          className="lg:col-span-3"
          icon={Route}
          iconMotion="group-hover:translate-x-0.5 group-hover:-rotate-12"
          title="A path that adapts"
          text="Mastered topics are skipped and slipping ones come back. The path reorders itself within the prerequisite order."
        >
          <PathDemo />
        </FeatureCard>
        <FeatureCard
          className="md:col-span-2 lg:col-span-3"
          delay={80}
          icon={Layers}
          iconMotion="group-hover:rotate-180"
          title="Review that sticks"
          text="Flashcards are generated from each lesson and scheduled for spaced review, so what you learn stays learned."
        >
          <div className="bg-surface-2 border-border flex flex-col gap-4 rounded-xl border p-3.5">
            <FlashcardDemo />
            <Heatmap />
          </div>
        </FeatureCard>
      </div>
    </section>
  );
}
