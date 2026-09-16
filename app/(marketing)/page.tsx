"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/loading-ring";
import { useSession } from "@/components/SessionProvider";
import { Reveal } from "./_components/Reveal";
import { AdaptivePathDemo } from "./_components/AdaptivePathDemo";

// WebGL background — client-only. three.js can't run during SSR, and this
// keeps the ~three.js chunk out of the initial bundle until the page mounts.
const Dither = dynamic(() => import("@/components/Dither"), { ssr: false });

/** Shared section heading: mono index, display title, optional standfirst. */
function SectionHead({
  index,
  title,
  lead,
}: {
  index: string;
  title: string;
  lead?: string;
}) {
  return (
    <Reveal className="flex flex-col gap-3">
      <span className="text-muted-foreground/60 font-mono text-[10px] uppercase tracking-[0.18em]">
        {index}
      </span>
      <h2 className="h-display text-2xl sm:text-3xl">{title}</h2>
      {lead && (
        <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
          {lead}
        </p>
      )}
    </Reveal>
  );
}

const STEPS = [
  {
    n: "01",
    t: "Describe",
    d: "Say what you want to learn, however vaguely. A clarity loop asks follow-ups until the goal is sharp enough to plan against.",
  },
  {
    n: "02",
    t: "Diagnose",
    d: "A short adaptive quiz spans difficulty bands to find where you actually are — with an honest “I don't know” on every question.",
  },
  {
    n: "03",
    t: "Generate",
    d: "Modules and lessons are written for that level and sorted by prerequisite, so nothing arrives before the thing it depends on.",
  },
  {
    n: "04",
    t: "Adapt",
    d: "Every practice answer moves a rolling mastery score. The path reorders, skips what you've proven, and resurfaces what slipped.",
  },
];

const TUTOR_THREAD = [
  { from: "learner", text: "Just tell me why my group-by returns NaN." },
  {
    from: "tutor",
    text: "Not yet — you're close. Before the group-by runs, what does that column's dtype say? And what does sum() do with a value it can't add?",
  },
  { from: "learner", text: "…oh. It's an object column, not a float." },
  {
    from: "tutor",
    text: "That's it. So what's the one call you'd put in front of the group-by?",
  },
] as const;

export default function Home() {
  const router = useRouter();
  const { me } = useSession();

  useEffect(() => {
    if (me) router.replace("/topics");
  }, [me, router]);

  // `undefined` is the session still resolving; a signed-in learner gets the
  // redirect above, so only the signed-out marketing page falls through.
  if (me === undefined || me) return <PageLoader />;

  return (
    <>
      {/* Full-bleed animated background — fixed behind all content. Cool-slate
          waves sit inside the ~200° theme; the gradient darkens downward so
          copy stays legible and the field blends into the page background.
          Mouse interaction is off since it sits behind content. */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <Dither
          waveColor={[0.3, 0.4, 0.46]}
          waveSpeed={0.03}
          waveFrequency={3}
          waveAmplitude={0.3}
          colorNum={4}
          pixelSize={2}
          enableMouseInteraction={false}
        />
        {/* Two overlays. The vertical one tames the bright top of the field so
            the headline keeps its contrast, and stops at /92 rather than solid
            so the lower sections still sit on a living surface instead of flat
            black. The radial one vignettes the corners inward. */}
        <div className="from-background/55 via-background/78 to-background/92 absolute inset-0 bg-linear-to-b" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,transparent_35%,var(--background)_100%)] opacity-70" />
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-4xl px-4 pt-16 pb-20 sm:px-6 sm:pt-28 sm:pb-28">
        <div className="flex flex-col gap-7">
          <Reveal>
            <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
              Adaptive learning, paced for you
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="h-display text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-7xl">
              A path drawn from
              <br className="hidden sm:block" /> where you{" "}
              <span className="relative whitespace-nowrap">
                actually are
                {/* Hand-drawn underline: draws itself once, then rests. */}
                <svg
                  aria-hidden
                  viewBox="0 0 300 12"
                  preserveAspectRatio="none"
                  className="text-primary/50 absolute bottom-[-0.16em] left-0 h-[0.3em] w-full"
                >
                  <path
                    d="M2 8C60 3 120 2 180 4C220 5.2 260 7 298 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className="underline-draw"
                  />
                </svg>
              </span>
              .
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-muted-foreground max-w-xl text-base leading-relaxed sm:text-lg">
              Most courses start at lesson one whoever you are. LearnPath
              diagnoses your level first, writes a curriculum around it, and
              keeps rewriting that curriculum as your mastery shifts.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="h-11 px-5 text-sm"
                onClick={() => router.push("/login")}
              >
                Get started
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="text-muted-foreground h-11 px-4 text-sm"
                asChild
              >
                <Link href="/login">I already have an account</Link>
              </Button>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <ul className="text-muted-foreground/70 border-border/60 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-6 font-mono text-[11px]">
              {[
                "Adaptive intake quiz",
                "Prerequisite-ordered path",
                "AI-authored lessons",
                "Socratic tutor",
              ].map((f) => (
                <li key={f} className="flex items-center gap-1.5">
                  <span className="bg-primary/50 size-1 rounded-full" />
                  {f}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── 01 · The adaptive mechanic, demonstrated ─────────────────────── */}
      <section className="border-border/60 border-t">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-20 sm:px-6 sm:py-24">
          <SectionHead
            index="01 · The mechanic"
            title="The path rewrites itself."
            lead="Not a playlist you work through in order. Mastery is a rolling score over every answer you give, and it decides what sits at the top of your path next."
          />
          <Reveal delay={100}>
            <AdaptivePathDemo />
          </Reveal>
        </div>
      </section>

      {/* ── 02 · How it works ───────────────────────────────────────────── */}
      <section className="border-border/60 border-t">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-20 sm:px-6 sm:py-24">
          <SectionHead index="02 · The flow" title="Four steps, then it runs." />
          <ol className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.n} delay={i * 70}>
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground/50 font-mono text-[10px] tracking-[0.16em]">
                      {s.n}
                    </span>
                    <span className="bg-border h-px flex-1" />
                  </div>
                  <span className="text-base font-medium">{s.t}</span>
                  <span className="text-muted-foreground text-sm leading-relaxed">
                    {s.d}
                  </span>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 03 · Inside a lesson ────────────────────────────────────────── */}
      <section className="border-border/60 border-t">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-20 sm:px-6 sm:py-24">
          <SectionHead
            index="03 · The lessons"
            title="Written for you, not retrieved."
            lead="Each lesson is authored against your level and objectives: an explanation, an analogy that lands, a worked example, and practice that grades the moment you answer."
          />
          <Reveal delay={100}>
            <div className="bg-surface-1/60 border-border/60 flex flex-col gap-5 rounded-2xl border p-5 backdrop-blur-sm sm:p-7">
              <div className="flex flex-col gap-2">
                <span className="text-muted-foreground/70 font-mono text-[10px] uppercase tracking-[0.18em]">
                  Analogy
                </span>
                <p className="text-sm leading-relaxed">
                  A <span className="font-medium">group-by</span> is a mail
                  sorter: every row drops into the pigeonhole named by its key,
                  and only once every row has landed do you weigh each pile.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-muted-foreground/70 font-mono text-[10px] uppercase tracking-[0.18em]">
                  Example
                </span>
                <pre className="bg-background/60 border-border/60 overflow-x-auto rounded-xl border p-4 font-mono text-xs leading-relaxed">
                  <code>{`sales.groupby("region")["revenue"].sum()`}</code>
                </pre>
              </div>

              {/* The practice card, mirroring the real one in the lesson page. */}
              <div className="border-primary/30 bg-surface-1 flex flex-col gap-3 rounded-xl border border-l-4 p-4">
                <span className="text-primary font-mono text-[10px] uppercase tracking-[0.18em]">
                  Practice
                </span>
                <p className="text-sm font-medium">
                  Which call returns one row per region?
                </p>
                <div className="flex flex-col gap-1.5 text-sm">
                  {[
                    { t: 'sales["region"].sum()', ok: false },
                    { t: 'sales.groupby("region").sum()', ok: true },
                    { t: 'sales.sort_values("region")', ok: false },
                  ].map((c) => (
                    <div
                      key={c.t}
                      className={
                        c.ok
                          ? "bg-primary/10 flex items-center gap-2 rounded-md px-2 py-1.5 font-mono text-xs font-medium"
                          : "text-muted-foreground flex items-center gap-2 rounded-md px-2 py-1.5 font-mono text-xs"
                      }
                    >
                      {c.ok ? (
                        <Check className="text-primary size-3.5 shrink-0" />
                      ) : (
                        <span className="size-3.5 shrink-0" />
                      )}
                      {c.t}
                    </div>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  Multiple choice is graded on the spot — no waiting on a server
                  round trip.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 04 · The tutor ──────────────────────────────────────────────── */}
      <section className="border-border/60 border-t">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-20 sm:px-6 sm:py-24">
          <SectionHead
            index="04 · The tutor"
            title="It won't just tell you."
            lead="The tutor is grounded in your own curriculum and lesson text, so it answers about what you're actually studying. Ask it for the answer outright and it hands you the next question instead."
          />
          <Reveal delay={100}>
            <div className="bg-surface-1/60 border-border/60 overflow-hidden rounded-2xl border backdrop-blur-sm">
              <div className="border-border/60 flex items-center gap-2 border-b px-4 py-2.5">
                <span className="text-muted-foreground/70 font-mono text-[10px] uppercase tracking-[0.16em]">
                  Tutor
                </span>
                <span className="text-muted-foreground/40 font-mono text-[10px]">
                  / grounded in your own lessons
                </span>
              </div>

              <div className="flex flex-col gap-3 p-4 sm:p-6">
                {TUTOR_THREAD.map((m, i) =>
                  m.from === "learner" ? (
                    <p
                      key={i}
                      className="bg-muted/50 border-border/60 ml-auto max-w-md rounded-2xl rounded-br-sm border px-4 py-2.5 text-sm"
                    >
                      {m.text}
                    </p>
                  ) : (
                    <p
                      key={i}
                      className="bg-background/50 border-border/60 mr-auto max-w-md rounded-2xl rounded-bl-sm border px-4 py-2.5 text-sm leading-relaxed"
                    >
                      {m.text}
                    </p>
                  ),
                )}
              </div>

              <p className="text-muted-foreground/60 border-border/60 flex items-center gap-1.5 border-t px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em]">
                <X className="size-3" />
                Never hands over the answer
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Close ───────────────────────────────────────────────────────── */}
      <section className="border-border/60 border-t">
        <div className="mx-auto w-full max-w-4xl px-4 py-24 sm:px-6 sm:py-28">
          <Reveal className="flex flex-col items-start gap-6">
            <h2 className="h-display max-w-2xl text-3xl sm:text-5xl">
              Start where you are, not at lesson one.
            </h2>
            <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
              Describe a topic and take the quiz — the first path is generated
              from there.
            </p>
            <Button
              size="lg"
              className="h-11 px-5 text-sm"
              onClick={() => router.push("/login")}
            >
              Get started
              <ArrowRight data-icon="inline-end" />
            </Button>
          </Reveal>
        </div>
      </section>

      <footer className="border-border/60 border-t">
        <div className="text-muted-foreground/60 mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-8 sm:px-6">
          <span className="text-foreground/80 text-sm font-medium">
            LearnPath
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em]">
            Adaptive learning, paced for you
          </span>
        </div>
      </footer>
    </>
  );
}
