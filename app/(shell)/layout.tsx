/**
 * The signed in product surface: sidebar plus an inset main area. Pages pick
 * their own width with `PageContainer` and render their own `PageHeader`.
 *
 * The user and the sidebar cookies are read here so the first paint already has
 * the right collapsed state and width. The sidebar's data streams behind its own
 * Suspense boundary, so a page never waits for it.
 */
import { Suspense } from "react";
import { cookies } from "next/headers";
import { requireUserOrRedirect } from "@/lib/auth/current";
import { readPrefs } from "@/lib/server/prefs";
import { SidebarInset } from "@/components/ui/sidebar";
import { ShellFrame } from "@/components/shell/ShellFrame";
import { SidebarFrame } from "@/components/shell/SidebarFrame";
import { SidebarSkeleton } from "@/components/shell/SidebarSkeleton";
import { AppSidebarLoader } from "@/components/shell/AppSidebarLoader";
import { ShellDataLoader } from "@/components/shell/ShellDataLoader";
import {
  clampSidebarWidth,
  SIDEBAR_STATE_COOKIE,
  SIDEBAR_WIDTH_COOKIE,
  SIDEBAR_WIDTH_DEFAULT,
} from "@/components/shell/constants";

export default async function ShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUserOrRedirect();
  const [cookieStore, prefs] = await Promise.all([
    cookies(),
    readPrefs(user._id),
  ]);

  const defaultOpen = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value !== "false";
  const storedWidth = Number(cookieStore.get(SIDEBAR_WIDTH_COOKIE)?.value);
  const width =
    Number.isFinite(storedWidth) && storedWidth > 0
      ? clampSidebarWidth(storedWidth)
      : SIDEBAR_WIDTH_DEFAULT;

  const sidebarUser = {
    name: user.displayName || user.email.split("@")[0],
    email: user.email,
  };

  return (
    <ShellFrame
      defaultOpen={defaultOpen}
      defaultWidth={width}
      focusLessons={prefs.focusLessons}
    >
      <SidebarFrame>
        <Suspense fallback={<SidebarSkeleton />}>
          <AppSidebarLoader
            userId={user._id.toHexString()}
            user={sidebarUser}
          />
        </Suspense>
      </SidebarFrame>
      <Suspense fallback={null}>
        <ShellDataLoader userId={user._id.toHexString()} />
      </Suspense>
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </ShellFrame>
  );
}
