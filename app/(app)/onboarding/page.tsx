import { requireUserOrRedirect } from "@/lib/auth/current";
import { getResumableOnboarding } from "@/lib/data/onboarding";
import { OnboardingChat, type ClarityResponse, type Turn } from "./OnboardingChat";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string | string[] }>;
}) {
  // "New topic" links carry ?new=1: start fresh instead of resuming.
  const isNew = (await searchParams).new === "1";
  const user = await requireUserOrRedirect();
  const ob = isNew ? null : await getResumableOnboarding(user._id.toHexString());

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
      initialTurns={initialTurns}
      initialDone={initialDone}
    />
  );
}
