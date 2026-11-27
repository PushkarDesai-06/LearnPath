/**
 * Topbar, resolved on the server. The session and topic list are read during
 * render (no /api/me or /api/topics round trip). It lives in the root layout,
 * which does NOT re-render on client navigation — identity changes arrive via
 * the auth Server Actions (a cookie write re-renders the tree) and topic list
 * changes via `router.refresh()` after a mutation.
 */
import { getCurrentUser } from "@/lib/auth/current";
import { publicUser } from "@/lib/auth/guards";
import { listTopics } from "@/lib/data/topics";
import { NavBar } from "@/components/NavBar";

export async function Nav() {
  const user = await getCurrentUser();
  if (!user) return <NavBar user={null} topics={[]} />;

  const topics = await listTopics(user._id.toHexString());
  return (
    <NavBar
      user={publicUser(user)}
      topics={topics.map((t) => ({
        id: t.id,
        title: t.title,
        mastery: t.summary.overallMastery,
      }))}
    />
  );
}
