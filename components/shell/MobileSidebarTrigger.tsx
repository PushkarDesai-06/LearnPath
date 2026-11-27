"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

/** Opens the sidebar sheet on phones. Hidden from 768px up, where the sidebar is docked. */
export function MobileSidebarTrigger() {
  const { setOpenMobile } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Open navigation"
      onClick={() => setOpenMobile(true)}
      className="-ml-1 md:hidden"
    >
      <Menu />
    </Button>
  );
}
