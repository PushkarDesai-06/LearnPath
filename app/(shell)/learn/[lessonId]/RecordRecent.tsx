"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";

/**
 * Records this lesson in the learner's recents once per visit, then refreshes
 * so the sidebar's Recent group picks it up. Done in an effect, never during
 * render, because pages also render on prefetch.
 */
export function RecordRecent({
  curriculumId,
  lessonId,
}: {
  curriculumId: string;
  lessonId: string;
}) {
  const router = useRouter();
  const recorded = useRef<string | null>(null);

  useEffect(() => {
    if (recorded.current === lessonId) return;
    recorded.current = lessonId;
    api("/api/me/recents", { body: { curriculumId, lessonId } })
      .then(() => router.refresh())
      .catch(() => {});
  }, [curriculumId, lessonId, router]);

  return null;
}
