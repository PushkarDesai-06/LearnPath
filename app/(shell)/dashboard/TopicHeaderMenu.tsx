"use client";

import { EntryMenu } from "@/components/shell/EntryMenu";
import { useTopicMenus } from "@/components/shell/useTopicMenus";
import { topicHasProgress } from "@/lib/client/topicState";

/** The topic's 3 dot menu in the page header, with its rename and delete dialogs. */
export function TopicHeaderMenu({
  id,
  title,
  mastery,
  lessonsMastered,
}: {
  id: string;
  title: string;
  mastery: number;
  lessonsMastered: number;
}) {
  const topicUi = useTopicMenus();
  const entries = topicUi.menu({
    id,
    title,
    hasProgress: topicHasProgress({ mastery, lessonsMastered }),
  });

  return (
    <>
      <EntryMenu entries={entries} label="Topic actions" />
      {topicUi.dialogs}
    </>
  );
}
