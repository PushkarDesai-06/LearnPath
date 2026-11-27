import { getShellData } from "@/lib/data/shell";
import { AppSidebar, type SidebarUser } from "@/components/shell/AppSidebar";

/** Reads the shell data on the server, behind a Suspense boundary so pages never wait for it. */
export async function AppSidebarLoader({
  userId,
  user,
}: {
  userId: string;
  user: SidebarUser;
}) {
  const data = await getShellData(userId);
  return <AppSidebar user={user} data={data} />;
}
