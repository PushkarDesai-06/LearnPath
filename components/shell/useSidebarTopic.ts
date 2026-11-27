"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useActiveTopic } from "@/components/ActiveTopic";
import { TOPIC_SCOPED_ROUTES } from "@/components/shell/constants";

const noopSubscribe = () => () => {};

/**
 * Which topic the learner is working in. Topic scoped routes name it in `?id=`
 * and fall back to the newest topic (the first entry, the server sorts newest
 * first). Lessons announce theirs through `ActiveTopicMarker`. Everywhere else
 * (topics list, account) none is active, and `fallbackId` is the newest topic
 * so the primary nav still has somewhere to go.
 */
export function useSidebarTopic(topicIds: string[]) {
  const pathname = usePathname();
  const idParam = useSearchParams().get("id");
  const announcedTopic = useActiveTopic();
  // The announcement is written from an effect that can run before this
  // Suspense wrapped sidebar hydrates, so ignore it until hydration is done.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const announced = hydrated ? announcedTopic : null;

  const scoped = TOPIC_SCOPED_ROUTES.includes(pathname);
  const candidate = scoped ? (idParam ?? topicIds[0] ?? null) : announced;
  const activeId = candidate && topicIds.includes(candidate) ? candidate : null;

  return { pathname, activeId, fallbackId: activeId ?? topicIds[0] ?? null };
}
