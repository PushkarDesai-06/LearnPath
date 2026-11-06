import { notFound, redirect } from "next/navigation";
import { requireUserOrRedirect } from "@/lib/auth/current";
import { readAssessmentState } from "@/lib/data/assessment";
import { AssessmentClient } from "./AssessmentClient";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Knowledge check" };

export default async function AssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ ob?: string | string[] }>;
}) {
  const { ob } = await searchParams;
  // Topics "Continue" and the onboarding hand-off name the setup with ?ob=.
  const onboardingId = typeof ob === "string" ? ob : null;
  const user = await requireUserOrRedirect();
  const state = await readAssessmentState(user._id.toHexString(), onboardingId);
  if (state.kind === "no_onboarding") {
    // A named setup that isn't the learner's (or isn't at the quiz stage).
    if (onboardingId) notFound();
    // No clarified topic yet: the quiz has nothing to be about.
    redirect("/onboarding");
  }
  return (
    <AssessmentClient
      // The client seeds its state once; a different setup (another ?ob=, or
      // Back/Forward between two) must remount it rather than reuse it.
      key={`${onboardingId ?? "latest"}:${state.kind === "fresh" ? "fresh" : state.assessmentId}`}
      initial={state}
      onboardingId={onboardingId}
    />
  );
}
