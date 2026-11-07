"use server";

/**
 * Path generation as a Server Action, not a fetch to the API route: the new
 * topic has to show up in the topbar's switcher, which is rendered by the root
 * layout. Invalidating the layout here and redirecting in the same action
 * re-renders the Nav with the new topic as the dashboard lands. (A Route
 * Handler's revalidatePath only takes effect on the next visit.)
 */
import "server-only";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserOrRedirect } from "@/lib/auth/current";
import { generateCurriculum } from "@/lib/server/curriculumGeneration";

export async function generatePathAction(assessmentId: string): Promise<{ error: string }> {
  if (!/^[a-f0-9]{24}$/i.test(assessmentId)) return { error: "Invalid assessment." };
  const user = await requireUserOrRedirect();
  let curriculumId: string;
  try {
    const { curriculum } = await generateCurriculum(user._id, new ObjectId(assessmentId));
    curriculumId = curriculum._id.toHexString();
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't build your path." };
  }
  revalidatePath("/", "layout");
  redirect(`/dashboard?id=${curriculumId}`);
}
