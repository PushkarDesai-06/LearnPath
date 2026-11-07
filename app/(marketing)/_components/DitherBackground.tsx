"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

// WebGL background — client-only. three.js can't run during SSR, and this
// keeps the three.js chunk out of the initial bundle until the page mounts.
// `ssr: false` is only allowed inside a Client Component, hence this island.
const Dither = dynamic(() => import("@/components/Dither"), { ssr: false });

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Live `prefers-reduced-motion`, so the canvas freezes the moment it's set. */
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/**
 * Animated hero backdrop. Sized to its positioned parent rather than the
 * viewport, so only the hero gets the living field. It reaches up behind the
 * sticky nav (h-14) and spills a little past the hero's bottom edge, where it
 * dissolves: the whole layer is masked to transparent while a backdrop blur,
 * itself masked to grow toward the bottom, softens the dither as it goes.
 * Mouse interaction is off since it sits behind content.
 */
export function DitherBackground() {
  // The CSS motion on this page already stops under reduced motion; the WebGL
  // field has to be told, or it keeps animating behind the copy.
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-14 -bottom-24 -z-10 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]">
      <Dither
        waveColor={[0.3, 0.4, 0.46]}
        waveSpeed={0.03}
        waveFrequency={3}
        waveAmplitude={0.3}
        colorNum={4}
        pixelSize={2}
        enableMouseInteraction={false}
        disableAnimation={reducedMotion}
      />
      {/* The vertical overlay tames the bright top of the field so the
          headline keeps its contrast; the radial one vignettes the corners. */}
      <div className="from-background/55 via-background/75 to-background/85 absolute inset-0 bg-linear-to-b" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,transparent_35%,var(--background)_100%)] opacity-70" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 backdrop-blur-xl [mask-image:linear-gradient(to_bottom,transparent,black_70%)]" />
    </div>
  );
}
