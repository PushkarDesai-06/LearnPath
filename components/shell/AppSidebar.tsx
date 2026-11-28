"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar";
import { SidebarHeader } from "@/components/shell/SidebarHeader";
import { PrimaryNav, SidebarSearch } from "@/components/shell/SidebarNav";
import { LessonGroup } from "@/components/shell/SidebarLessons";
import { ArchivedGroup, TopicsGroup } from "@/components/shell/SidebarTopics";
import { SidebarFooter } from "@/components/shell/SidebarFooter";
import { useShellView } from "@/components/shell/useShellView";
import { useSidebarUi } from "@/components/shell/SidebarUi";
import { usePinActions } from "@/components/shell/usePinActions";
import { useTopicMenus } from "@/components/shell/useTopicMenus";
import { useSidebarGroups } from "@/components/shell/useSidebarGroups";
import { useSidebarTopic } from "@/components/shell/useSidebarTopic";
import type { ShellData } from "@/lib/data/types";

export interface SidebarUser {
  name: string;
  email: string;
}

/** The signed in navigation: account, search, topic scoped nav, pinned, recent and the topic tree. */
export function AppSidebar({
  user,
  data,
}: {
  user: SidebarUser;
  data: ShellData;
}) {
  const { setOpenMobile } = useSidebar();
  const { rail } = useSidebarUi();
  const search = useSearchParams().toString();
  const [editingId, setEditingId] = useState<string | null>(null);
  const { topics, archivedTopics, pins, recents } = useShellView(data);
  const pinnedIds = useMemo(
    () => new Set(pins.map((pin) => pin.lessonId)),
    [pins],
  );

  const pinActions = usePinActions(pins, recents);
  const topicUi = useTopicMenus({
    inlineRename: (topic) => {
      if (rail) return false;
      setEditingId(topic.id);
      return true;
    },
  });

  const { pathname, activeId, fallbackId } = useSidebarTopic(
    topics.map((t) => t.id),
  );
  const groups = useSidebarGroups(data.prefs.collapsedGroups, activeId);

  const navKey = `${pathname}?${search}`;
  const lastNavKey = useRef(navKey);

  useEffect(() => {
    if (lastNavKey.current === navKey) return;
    lastNavKey.current = navKey;
    setOpenMobile(false);
  }, [navKey, setOpenMobile]);

  const navTopic = topics.find((t) => t.id === fallbackId);

  return (
    <>
      <SidebarHeader name={user.name} email={user.email} />
      <SidebarSearch />
      <PrimaryNav
        pathname={pathname}
        topicId={fallbackId}
        dueCards={navTopic?.dueCards ?? 0}
      />
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-2 [scrollbar-color:var(--border-strong)_transparent] [scrollbar-width:thin]">
        <LessonGroup
          id="group:pinned"
          label="Pinned"
          kind="pinned"
          links={pins}
          pathname={pathname}
          open={groups.isGroupOpen("group:pinned")}
          onToggle={() => groups.toggleGroup("group:pinned")}
          pinnedIds={pinnedIds}
          actions={pinActions}
        />
        <LessonGroup
          id="group:recent"
          label="Recent"
          kind="recent"
          links={recents}
          pathname={pathname}
          open={groups.isGroupOpen("group:recent")}
          onToggle={() => groups.toggleGroup("group:recent")}
          pinnedIds={pinnedIds}
          actions={pinActions}
        />
        <TopicsGroup
          topics={topics}
          activeTopicId={activeId}
          open={groups.isGroupOpen("group:topics")}
          onToggleGroup={() => groups.toggleGroup("group:topics")}
          isTopicOpen={groups.isTopicOpen}
          onToggleTopic={groups.toggleTopic}
          topicUi={topicUi}
          editingId={editingId}
          onEditDone={() => setEditingId(null)}
        />
        <ArchivedGroup
          topics={archivedTopics}
          open={groups.isGroupOpen("group:archived")}
          onToggle={() => groups.toggleGroup("group:archived")}
          topicUi={topicUi}
        />
      </div>
      <SidebarFooter />
      {topicUi.dialogs}
    </>
  );
}
