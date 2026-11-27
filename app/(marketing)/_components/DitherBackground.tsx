"use client";

import dynamic from "next/dynamic";

// WebGL background — client-only. three.js can't run during SSR, and this
// keeps the three.js chunk out of the initial bundle until the page mounts.
// `ssr: false` is only allowed inside a Client Component, hence this island.
const Dither = dynamic(() => import("@/components/Dither"), { ssr: false });

/**
 * Full-bleed animated background — fixed behind all content. Cool-slate waves
 * sit inside the ~200° theme; the gradient darkens downward so copy stays
 * legible and the field blends into the page background. Mouse interaction is
 * off since it sits behind content.
 */
export function DitherBackground() {
  return (
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
  );
}
