"use client";

import { useMemo } from "react";
import { usePublishShellData } from "@/components/shell/ShellDataContext";
import { useShellView } from "@/components/shell/useShellView";
import type { ShellData } from "@/lib/data/types";

/**
 * Publishes shell data for the command palette. Mounted outside the sidebar,
 * because on phones the sidebar content only exists while its sheet is open.
 */
export function ShellDataPublisher({ data }: { data: ShellData }) {
  const { topics, archivedTopics, pins, recents } = useShellView(data);
  const snapshot = useMemo(
    () => ({ topics, archivedTopics, pins, recents, dueCardsTotal: data.dueCardsTotal }),
    [topics, archivedTopics, pins, recents, data.dueCardsTotal],
  );
  usePublishShellData(snapshot);
  return null;
}
