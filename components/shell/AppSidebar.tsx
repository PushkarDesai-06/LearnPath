"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar";
import { SidebarHeader } from "@/components/shell/SidebarHeader";
import { PrimaryNav, SidebarSearch } from "@/components/shell/SidebarNav";
import { LessonGroup } from "@/components/shell/SidebarLessons";
import { ArchivedGroup, TopicsGroup } from "@/components/shell/SidebarTopics";
import { SidebarFooter } from "@/components/shell/SidebarFooter";
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
  const search = useSearchParams().toString();
  const { pathname, activeId, fallbackId } = useSidebarTopic(
    data.topics.map((t) => t.id),
  );
  const groups = useSidebarGroups(data.prefs.collapsedGroups, activeId);

  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, search, setOpenMobile]);

  const navTopic = data.topics.find((t) => t.id === fallbackId);

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
          links={data.pins}
          pathname={pathname}
          open={groups.isGroupOpen("group:pinned")}
          onToggle={() => groups.toggleGroup("group:pinned")}
        />
        <LessonGroup
          id="group:recent"
          label="Recent"
          kind="recent"
          links={data.recents}
          pathname={pathname}
          open={groups.isGroupOpen("group:recent")}
          onToggle={() => groups.toggleGroup("group:recent")}
        />
        <TopicsGroup
          topics={data.topics}
          activeTopicId={activeId}
          open={groups.isGroupOpen("group:topics")}
          onToggleGroup={() => groups.toggleGroup("group:topics")}
          isTopicOpen={groups.isTopicOpen}
          onToggleTopic={groups.toggleTopic}
        />
        <ArchivedGroup
          topics={data.archivedTopics}
          open={groups.isGroupOpen("group:archived")}
          onToggle={() => groups.toggleGroup("group:archived")}
        />
      </div>
      <SidebarFooter />
    </>
  );
}
