"use client";

import { useEffect, useMemo } from "react";
import { shellOverrides, useShellOverrides } from "@/components/shell/shellOverrides";
import { applyTopicOverrides } from "@/lib/client/topicState";
import type { ShellData } from "@/lib/data/types";

/** Shell data with the pending optimistic changes applied. Fresh server data drops them. */
export function useShellView(data: ShellData) {
  const overrides = useShellOverrides();

  useEffect(() => {
    shellOverrides.clear();
  }, [data]);

  const { active: topics, archived: archivedTopics } = useMemo(
    () =>
      applyTopicOverrides(
        data.topics,
        data.archivedTopics,
        overrides.topics,
        (topic) => ({
          id: topic.id,
          title: topic.title,
          archivedAt: new Date().toISOString(),
        }),
      ),
    [data.topics, data.archivedTopics, overrides.topics],
  );

  return {
    topics,
    archivedTopics,
    pins: overrides.pins ?? data.pins,
    recents: overrides.recents ?? data.recents,
  };
}
