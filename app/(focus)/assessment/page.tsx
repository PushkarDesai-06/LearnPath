import { redirect } from "next/navigation";
import { requireUserOrRedirect } from "@/lib/auth/current";
import { readAssessmentState } from "@/lib/data/assessment";
import { AssessmentClient } from "./AssessmentClient";

export default async function AssessmentPage() {
  const user = await requireUserOrRedirect();
  const state = await readAssessmentState(user._id.toHexString());
  // No clarified topic yet — the quiz has nothing to be about.
  if (state.kind === "no_onboarding") redirect("/onboarding");
  return <AssessmentClient initial={state} />;
}
