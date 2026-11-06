import { notFound } from "next/navigation";
import { requireUserOrRedirect } from "@/lib/auth/current";
import { getResumableOnboarding } from "@/lib/data/onboarding";
import { OnboardingChat, type ClarityResponse, type Turn } from "./OnboardingChat";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "New topic" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string | string[]; ob?: string | string[] }>;
}) {
  const params = await searchParams;
  // "New topic" links carry ?new=1: start fresh instead of resuming.
  const isNew = params.new === "1";
  // Topics "Continue" names the setup it means with ?ob=.
  const requested = typeof params.ob === "string" ? params.ob : null;
  const user = await requireUserOrRedirect();
  const ob = isNew ? null : await getResumableOnboarding(user._id.toHexString(), requested);
  // A named setup that isn't the learner's, or is past this step.
  if (requested && !isNew && !ob) notFound();

  let initialTurns: Turn[] = [];
  let initialDone: ClarityResponse | null = null;
  if (ob?.status === "clarifying" && ob.exchanges.length > 0) {
    initialTurns = ob.exchanges;
  } else if (ob?.status === "ready") {
    initialDone = {
      clearEnough: true,
      done: true,
      capReached: false,
      cycle: ob.cycle,
      maxCycles: ob.maxCycles,
      followupQuestion: null,
      refinedTopic: ob.refinedTopic,
    };
  }

  return (
    <OnboardingChat
      // Remount on a ?new=1 ↔ resume switch so state re-seeds from props.
      key={isNew ? "new" : (ob?.id ?? "none")}
      isNew={isNew}
      initialOnboardingId={ob?.id ?? null}
      initialTurns={initialTurns}
      initialDone={initialDone}
    />
  );
}
