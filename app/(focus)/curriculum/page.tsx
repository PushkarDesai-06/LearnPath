// The learning path is part of the Dashboard (one navigable hub). This page
// just redirects any old /curriculum?id= links to /dashboard?id=.
import { redirect } from "next/navigation";

export default async function CurriculumPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const { id } = await searchParams;
  const topic = typeof id === "string" ? id : undefined;
  redirect(topic ? `/dashboard?id=${encodeURIComponent(topic)}` : "/dashboard");
}
